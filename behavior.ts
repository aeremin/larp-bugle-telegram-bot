import TelegramBot from 'node-telegram-bot-api';
import { saveReporterState, stateForReporter } from './reporter_state_machine';
import { preprocessMessageBeforeApproval, MessageVotes, createVoteMarkup, kVotesToApproveOrReject, recalculateVotes } from './util';
import { DatabaseInterface } from './storage';
import { BotConfig } from './config/config';

export function setUpBotBehavior(bot: TelegramBot, db: DatabaseInterface, config: BotConfig) {
  setUpPing(bot);
  setUpDebugLogging(bot);

  setUpReporterDialog(bot, db, config);

  setUpModeratorsVoting(bot, db, config);
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
}

function isPrivateMessage(msg: TelegramBot.Message): boolean {
  return msg.chat && msg.chat.type == 'private';
}

function setUpReporterDialog(bot: TelegramBot, db: DatabaseInterface, config: BotConfig) {
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

    const chatId = msg.chat.id;
    const s = stateForReporter(msg);
    if (s.state == 'start') {
      await bot.sendMessage(chatId, config.textMessages.NEED_SEND_ARTICLE_CMD);
    } else if (s.state == 'waiting_message') {
      await bot.sendMessage(chatId, config.textMessages.NEED_ARTICLE_TEXT);
    } else if (s.state == 'waiting_approval') {
      const votes = new MessageVotes();
      if (msg.from && msg.from.username != 'aleremin') {
        votes.disallowedToVote.push(msg.from.id);
      }
      const res = await bot.sendMessage(config.moderatorChatId, s.message as string, { reply_markup: createVoteMarkup(votes) });
      await db.saveDatastoreEntry(undefined, `${res.chat.id}_${res.message_id}`, votes);
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

  bot.onText(/^(.+)/, async (msg) => {
    if (!isPrivateMessage(msg)) return;

    // TODO: Support other types of content.
    if (!msg.text) return;

    if (msg.text.startsWith('/')) return;

    const chatId = msg.chat.id;
    const s = stateForReporter(msg);
    if (s.state == 'start') {
      await bot.sendMessage(chatId, config.textMessages.NEED_SEND_ARTICLE_CMD);
    } else if (s.state == 'waiting_message') {
      await bot.sendMessage(chatId, config.textMessages.ARTICLE_REQUEST_APPROVAL);
      s.state = 'waiting_approval';
      s.message = preprocessMessageBeforeApproval(msg.text, config.tag);
    } else if (s.state == 'waiting_approval') {
    }

    saveReporterState(msg, s);
  });
}


// Returns undefined iff failed to update votes (user already participated in the vote, vote cancelled, ...).
async function processVotesUpdate(db: DatabaseInterface, dbKey: string, userId: number, modifier: string | undefined): Promise<MessageVotes | undefined> {
  return db.updateDatastoreEntry(dbKey, (votes: MessageVotes) => {
    return modifier != undefined && !votes.finished && recalculateVotes(votes, userId, modifier);
  });
}

function setUpModeratorsVoting(bot: TelegramBot, db: DatabaseInterface, config: BotConfig) {
  bot.on('callback_query', async (query) => {
    console.log(`Received query: ${JSON.stringify(query)}`);
    if (!query.message || !query.message.text)
      return;

    const dbKey = `${query.message.chat.id}_${query.message.message_id}`;
    const maybeVotes = await processVotesUpdate(db, dbKey, query.from.id, query.data);
    if (maybeVotes) {
      if (maybeVotes.votesAgainst.length >= kVotesToApproveOrReject) {
        await bot.sendMessage(config.junkGroupId, query.message.text);
        await bot.deleteMessage(query.message.chat.id, query.message.message_id.toString());
      } else if (maybeVotes.votesFor.length >= kVotesToApproveOrReject) {
        await bot.sendMessage(config.newsChannelId, query.message.text);
        await bot.deleteMessage(query.message.chat.id, query.message.message_id.toString());
      } else {
        await bot.editMessageReplyMarkup(createVoteMarkup(maybeVotes),
          {chat_id: query.message.chat.id, message_id: query.message.message_id});
      }
    }

    await bot.answerCallbackQuery(query.id);
  });
}
