import TelegramBot from 'node-telegram-bot-api';
import { saveReporterState, stateForReporter } from './reporter_state_machine';
import { preprocessMessageBeforeApproval, MessageVotes, createVoteMarkup, recalculateVotes, Vote, UserStats, dbKeyForUser } from './util';
import { DatabaseInterface } from './storage';
import { BotConfig } from './config/config';

export function setUpBotBehavior(bot: TelegramBot,
    votesDb: DatabaseInterface<MessageVotes>,
    statsDb: DatabaseInterface<UserStats>,
    config: BotConfig) {
  setUpPing(bot);
  setUpDebugLogging(bot);

  setUpReporterDialog(bot, votesDb, statsDb, config);

  setUpVoting(bot, votesDb, statsDb, config);
}

function setUpPing(bot: TelegramBot) {
  bot.onText(/^\/ping(.*)/, async (msg, _match) => {
    const chatId = msg.chat.id;
    const res = await bot.sendMessage(chatId, 'Pong!');
    console.log(JSON.stringify(res));
  });
}

function setUpDebugLogging(bot: TelegramBot) {
  bot.on('message', async (msg) => {
    console.debug('message: ' + JSON.stringify(msg));
  });
  bot.on('channel_post', async (msg) => {
    console.debug('channel_post: ' + JSON.stringify(msg));
  });
  bot.on('edited_message', async (msg) => {
    console.debug('edited_message: ' + JSON.stringify(msg));
  });
}

function isPrivateMessage(msg: TelegramBot.Message): boolean {
  return msg.chat && msg.chat.type == 'private';
}

function anonymouslyForwardMessage(chatId: number, msg: TelegramBot.Message, options: TelegramBot.SendBasicOptions,
  tag: string | undefined, bot: TelegramBot) {
  if (msg.text) {
    return bot.sendMessage(chatId, preprocessMessageBeforeApproval(msg.text, tag), options);
  } else if (msg.photo) {
    return bot.sendPhoto(chatId, msg.photo[0].file_id,
      { ...options, caption: preprocessMessageBeforeApproval(msg.caption, tag) });
  }
}

function setUpReporterDialog(bot: TelegramBot, votesDb: DatabaseInterface<MessageVotes>, statsDb: DatabaseInterface<UserStats>, config: BotConfig) {
  bot.onText(/^\/start(.*)/, async (msg) => {
    if (!isPrivateMessage(msg)) return;
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, config.textMessages.HELLO_MESSAGE);
  });

  bot.onText(/^\/sendarticle(.*)/, async (msg) => {
    if (!isPrivateMessage(msg)) return;
    const chatId = msg.chat.id;
    const s = stateForReporter(msg);

    if (s.state == 'start' || s.state == 'waiting_message') {
      await bot.sendMessage(chatId, config.textMessages.SEND_ARTICLE_NOW);
      s.state = 'waiting_message';
    } else if (s.state == 'waiting_approval') {
      await bot.sendMessage(chatId, config.textMessages.ARTICLE_WAITING_FOR_APPROVAL);
    }

    saveReporterState(msg, s);
  });

  bot.onText(/^\/yes(.*)/, async (msg) => {
    if (!isPrivateMessage(msg)) return;
    if (!msg.from) return;

    const chatId = msg.chat.id;
    const s = stateForReporter(msg);
    if (s.state == 'start') {
      await bot.sendMessage(chatId, config.textMessages.NEED_SEND_ARTICLE_CMD);
    } else if (s.state == 'waiting_message') {
      await bot.sendMessage(chatId, config.textMessages.NEED_ARTICLE_TEXT);
    } else if (s.state == 'waiting_approval') {
      const votes = new MessageVotes();
      if (msg.from.username != 'aleremin') {
        votes.disallowedToVote.push(msg.from.id);
      }
      const res = await anonymouslyForwardMessage(config.moderatorChatId, s.message as TelegramBot.Message,
        { reply_markup: createVoteMarkup(votes) }, config.tag, bot);
      if (!res) {
        console.error('Failed to forward message!');
        return;
      }
      await votesDb.saveDatastoreEntry(`${res.chat.id}_${res.message_id}`, votes);
      await statsDb.updateDatastoreEntry(dbKeyForUser(msg.from), (stats: UserStats | undefined) => {
        stats = stats || new UserStats();
        stats.articlesProposed++;
        return stats;
      });
      console.log(JSON.stringify(res));
      await bot.sendMessage(chatId, config.textMessages.THANK_YOU_FOR_ARTICLE);
      s.state = 'start';
      s.message = undefined;
    }

    saveReporterState(msg, s);
  });

  bot.onText(/^\/no(.*)/, async (msg) => {
    if (!isPrivateMessage(msg)) return;

    const chatId = msg.chat.id;
    const s = stateForReporter(msg);
    s.state = 'start';
    s.message = undefined;
    await bot.sendMessage(chatId, config.textMessages.ARTICLE_SEND_WAS_CANCELLED);
    saveReporterState(msg, s);
  });

  const articleHandler = async (msg: TelegramBot.Message) => {
    if (!isPrivateMessage(msg)) return;
    if (!msg.text && !msg.photo) return;
    if (msg.text && msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const s = stateForReporter(msg);
    if (s.state == 'start') {
      await bot.sendMessage(chatId, config.textMessages.NEED_SEND_ARTICLE_CMD);
    } else if (s.state == 'waiting_message') {
      await bot.sendMessage(chatId, config.textMessages.ARTICLE_REQUEST_APPROVAL);
      s.state = 'waiting_approval';
      s.message = msg;
    } else if (s.state == 'waiting_approval') {
    }

    saveReporterState(msg, s);
  };

  bot.onText(/^(.+)/, articleHandler);
  bot.on('photo', articleHandler);

  bot.on('edited_message', async (msg) => {
    if (!isPrivateMessage(msg)) return;
    const s = stateForReporter(msg);
    if (s.state != 'waiting_approval' || !s.message) return;
    if (msg.message_id == s.message.message_id) {
      s.message = msg;
    }
  });
}

function stringToVote(s: string | undefined): Vote | undefined {
  if (s == '+') return '+';
  if (s == '-') return '-';
  return undefined;
}

const kVotesToApproveOrReject = 2;

// Returns undefined iff failed to update votes (user already participated in the vote, vote cancelled, ...).
async function processVotesUpdate(db: DatabaseInterface<MessageVotes>, dbKey: string, userId: number,
  modifier: string | undefined, votesToComplete: number): Promise<MessageVotes | undefined> {
  return db.updateDatastoreEntry(dbKey, (votes: MessageVotes | undefined) => {
    const vote = stringToVote(modifier);
    votes = votes || new MessageVotes();
    if (vote && recalculateVotes(votes, userId, vote, votesToComplete)) {
      return votes;
    }
    return undefined;
  });
}

function setUpVoting(bot: TelegramBot, votesDb: DatabaseInterface<MessageVotes>, statsDb: DatabaseInterface<UserStats>, config: BotConfig) {
  bot.on('callback_query', async (query) => {
    console.log(`Received query: ${JSON.stringify(query)}`);
    if (!query.message)
      return;

    const isModeratorVoting = query.message.chat.id == config.moderatorChatId;

    const votesToComplete = isModeratorVoting ? kVotesToApproveOrReject : 1000000;

    const dbKey = `${query.message.chat.id}_${query.message.message_id}`;

    const maybeVotes = await processVotesUpdate(votesDb, dbKey, query.from.id, query.data, votesToComplete);

    if (maybeVotes) {
      await statsDb.updateDatastoreEntry(dbKeyForUser(query.from), (stats: UserStats | undefined) => {
        stats = stats || new UserStats();
        if (isModeratorVoting) {
          stats.votesAsModerator++;
        } else {
          stats.votesAsReader++;
        }
        return stats;
      });

      if (maybeVotes.votesAgainst.length >= votesToComplete) {
        await anonymouslyForwardMessage(config.junkGroupId, query.message, {}, undefined, bot);
        await bot.deleteMessage(query.message.chat.id, query.message.message_id.toString());
      } else if (maybeVotes.votesFor.length >= votesToComplete) {
        const votesInChannel = new MessageVotes();
        const res = await anonymouslyForwardMessage(config.newsChannelId, query.message,
          { reply_markup: createVoteMarkup(votesInChannel)}, undefined, bot);
        await bot.deleteMessage(query.message.chat.id, query.message.message_id.toString());
        if (!res) {
          console.error('Failed to forward message!');
          return;
        }
        await votesDb.saveDatastoreEntry(`${res.chat.id}_${res.message_id}`, votesInChannel);
      } else {
        await bot.editMessageReplyMarkup(createVoteMarkup(maybeVotes),
          { chat_id: query.message.chat.id, message_id: query.message.message_id });
      }
    }

    await bot.answerCallbackQuery(query.id);
  });
}
