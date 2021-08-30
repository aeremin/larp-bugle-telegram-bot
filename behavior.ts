import { Context, Telegraf } from 'telegraf'
import { ExtraReplyMessage } from 'telegraf/typings/telegram-types';
import { Message } from 'typegram'
import { CallbackQuery } from 'typegram/callback';
import { BotConfig } from './config/config';
import { DatabaseInterface } from './storage';
import {
  createVoteMarkup,
  dbKeyForUser,
  MessageVotes,
  NewsArticle,
  preprocessMessageBeforeApproval,
  recalculateVotes,
  ReporterStateAndMessage,
  UserStats,
  Vote,
} from './util';
import { forwardMessageToVk } from './vk_helper';

export function setUpBotBehavior(
  bot: Telegraf,
  votesDb: DatabaseInterface<MessageVotes>,
  statsDb: DatabaseInterface<UserStats>,
  articlesDb: DatabaseInterface<NewsArticle>,
  reporterStatesDb: DatabaseInterface<ReporterStateAndMessage>,
  config: BotConfig,
) {
  setUpPing(bot);
  setUpReporterDialog(bot, votesDb, statsDb, articlesDb, reporterStatesDb, config);
  setUpVoting(bot, votesDb, statsDb, articlesDb, config);
}

function setUpPing(bot: Telegraf) {
  bot.hears('/ping', async (ctx) => {
    const res = await ctx.reply('Pong!');
    console.log(JSON.stringify(res));
  });
}

function isPrivateMessage(msg: Message): boolean {
  return msg.chat && msg.chat.type == 'private';
}

function anonymouslyForwardMessage(
  chatId: number,
  msg: Message.TextMessage | Message.PhotoMessage,
  options: ExtraReplyMessage,
  tag: string | undefined,
  ctx: Context,
) {
  if ('text' in msg) {
    return ctx.telegram.sendMessage(
      chatId,
      preprocessMessageBeforeApproval(msg.text, tag),
      options,
    );
  } else if ('photo' in msg) {
    return ctx.telegram.sendPhoto(chatId, msg.photo[0].file_id, {
      ...options,
      caption: preprocessMessageBeforeApproval(msg.caption, tag),
    });
  }
}

function setUpReporterDialog(
  bot: Telegraf,
  votesDb: DatabaseInterface<MessageVotes>,
  statsDb: DatabaseInterface<UserStats>,
  articlesDb: DatabaseInterface<NewsArticle>,
  reporterStatesDb: DatabaseInterface<ReporterStateAndMessage>,
  config: BotConfig,
) {
  bot.hears('/start', async ctx => {
    console.log('GOT START')
    if (!isPrivateMessage(ctx.message)) return;
    await ctx.reply(config.textMessages.HELLO_MESSAGE);
  });

  bot.hears('/sendarticle', async ctx => {
    if (!isPrivateMessage(ctx.message)) return;
    const s = (await reporterStatesDb.readDatastoreEntry(ctx.message.from.id.toString())) ?? { state: 'start' };

    if (s.state == 'start' || s.state == 'waiting_message') {
      await ctx.reply(config.textMessages.SEND_ARTICLE_NOW);
      s.state = 'waiting_message';
    } else if (s.state == 'waiting_approval') {
      await ctx.reply(config.textMessages.ARTICLE_WAITING_FOR_APPROVAL);
    }

    await reporterStatesDb.saveDatastoreEntry(ctx.message.from.id.toString(), s);
  });

  bot.hears('/yes', async ctx => {
    if (!isPrivateMessage(ctx.message)) return;
    const s = (await reporterStatesDb.readDatastoreEntry(ctx.message.from.id.toString())) ?? { state: 'start' };
    if (s.state == 'start') {
      await ctx.reply(config.textMessages.NEED_SEND_ARTICLE_CMD);
    } else if (s.state == 'waiting_message') {
      await ctx.reply(config.textMessages.NEED_ARTICLE_TEXT);
    } else if (s.state == 'waiting_approval') {
      const votes = new MessageVotes();
      votes.disallowedToVote.push(ctx.message.from.id);
      const res = await anonymouslyForwardMessage(
        config.moderatorChatId,
        s.message!,
        { reply_markup: createVoteMarkup(votes) },
        config.tag,
        ctx,
      );
      if (!res) {
        console.error('Failed to forward message!');
        return;
      }
      await votesDb.saveDatastoreEntry(
        `${res.chat.id}_${res.message_id}`,
        votes,
      );
      await statsDb.updateDatastoreEntry(
        dbKeyForUser(ctx.message.from),
        (stats: UserStats | undefined) => {
          stats = stats || new UserStats();
          stats.articlesProposed++;
          return stats;
        },
      );
      await articlesDb.saveDatastoreEntry(res.message_id.toString(), {
        submitterId: ctx.message.from.id,
        submitterName: `${ctx.message.from.username} (${ctx.message.from.first_name} ${ctx.message.from.last_name})`,
        submissionTime: new Date(),
        wasPublished: false,
        text: 'text' in s.message! ? s.message.text : (('caption' in s.message! && s.message.caption) ? s.message.caption : '')
      });
      await ctx.reply(config.textMessages.THANK_YOU_FOR_ARTICLE);
      s.state = 'start';
      s.message = undefined;
    }

    await reporterStatesDb.saveDatastoreEntry(ctx.message.from.id.toString(), s);
  });

  bot.hears('/no', async ctx => {
    if (!isPrivateMessage(ctx.message)) return;

    const chatId = ctx.message.chat.id;
    const s = (await reporterStatesDb.readDatastoreEntry(ctx.message.from.id.toString())) ?? { state: 'start' };
    s.state = 'start';
    s.message = undefined;
    await ctx.reply(config.textMessages.ARTICLE_SEND_WAS_CANCELLED);
    await reporterStatesDb.saveDatastoreEntry(ctx.message.from.id.toString(), s);
  });

  bot.on('text', async (ctx) => {
    console.log('GOT TEXT')
    if (!isPrivateMessage(ctx.message)) return;
    if (ctx.message.text && ctx.message.text.startsWith('/')) return;
    const s = (await reporterStatesDb.readDatastoreEntry(ctx.message.from.id.toString())) ?? { state: 'start' };
    if (s.state == 'start') {
      await ctx.reply(config.textMessages.NEED_SEND_ARTICLE_CMD);
    } else if (s.state == 'waiting_message') {
      await ctx.reply(config.textMessages.ARTICLE_REQUEST_APPROVAL);
      s.state = 'waiting_approval';
      s.message = ctx.message;
    } else if (s.state == 'waiting_approval') {
    }

    await reporterStatesDb.saveDatastoreEntry(ctx.message.from.id.toString(), s);
  });

  bot.on('photo', async (ctx) => {
    if (!isPrivateMessage(ctx.message)) return;
    const s = (await reporterStatesDb.readDatastoreEntry(ctx.message.from.id.toString())) ?? { state: 'start' };
    if (s.state == 'start') {
      await ctx.reply(config.textMessages.NEED_SEND_ARTICLE_CMD);
    } else if (s.state == 'waiting_message') {
      await ctx.reply(config.textMessages.ARTICLE_REQUEST_APPROVAL);
      s.state = 'waiting_approval';
      s.message = ctx.message;
    } else if (s.state == 'waiting_approval') {
    }

    await reporterStatesDb.saveDatastoreEntry(ctx.message.from.id.toString(), s);
  });

  bot.on('edited_message', async ctx => {
    if (!isPrivateMessage(ctx.editedMessage)) return;
    const s = (await reporterStatesDb.readDatastoreEntry(ctx.from.id.toString())) ?? { state: 'start' };
    if (s.state != 'waiting_approval' || !s.message) return;
    if (ctx.editedMessage.message_id == s.message.message_id) {
      s.message = ctx.editedMessage as Message.TextMessage | Message.PhotoMessage;
    }
  });
}

function stringToVote(s: string | undefined): Vote | undefined {
  if (s == '+') return '+';
  if (s == '-') return '-';
  return undefined;
}

const kVotesToApprove = 2;
const kVotesToReject = 3;

// Returns undefined iff failed to update votes (user already participated in the vote, vote cancelled, ...).
async function processVotesUpdate(
  db: DatabaseInterface<MessageVotes>,
  dbKey: string,
  userId: number,
  modifier: string | undefined,
  votesLimits: { votesToApprove: number, votesToReject: number },
): Promise<MessageVotes | undefined> {
  return db.updateDatastoreEntry(dbKey, (votes: MessageVotes | undefined) => {
    const vote = stringToVote(modifier);
    votes = votes || new MessageVotes();
    if (vote && recalculateVotes(votes, userId, vote, votesLimits)) {
      return votes;
    }
    return undefined;
  });
}

function setUpVoting(
  bot: Telegraf,
  votesDb: DatabaseInterface<MessageVotes>,
  statsDb: DatabaseInterface<UserStats>,
  articlesDb: DatabaseInterface<NewsArticle>,
  config: BotConfig,
) {
  bot.on('callback_query', async ctx => {
    const query = ctx.callbackQuery as CallbackQuery.DataCallbackQuery;

    if (!query.message) return;

    const isModeratorVoting = query.message.chat.id == config.moderatorChatId;

    const votesToApprove = isModeratorVoting
      ? kVotesToApprove
      : 1000000;

    const votesToReject = isModeratorVoting
      ? kVotesToReject
      : 1000000;

    const dbKey = `${query.message.chat.id}_${query.message.message_id}`;

    const maybeVotes = await processVotesUpdate(
      votesDb,
      dbKey,
      query.from.id,
      query.data,
      { votesToApprove, votesToReject },
    );

    if (maybeVotes) {
      await statsDb.updateDatastoreEntry(
        dbKeyForUser(query.from),
        (stats: UserStats | undefined) => {
          stats = stats || new UserStats();
          if (isModeratorVoting) {
            stats.votesAsModerator++;
          } else {
            stats.votesAsReader++;
          }
          return stats;
        },
      );

      if (maybeVotes.votesAgainst.length >= votesToReject) {
        await anonymouslyForwardMessage(
          config.junkGroupId,
          query.message as Message.TextMessage | Message.PhotoMessage,
          {},
          undefined,
          ctx,
        );
        await ctx.deleteMessage();
      } else if (maybeVotes.votesFor.length >= votesToApprove) {
        const votesInChannel = new MessageVotes();
        const res = await anonymouslyForwardMessage(
          config.newsChannelId,
          query.message as Message.TextMessage | Message.PhotoMessage,
          { reply_markup: createVoteMarkup(votesInChannel) },
          undefined,
          ctx,
        );
        await articlesDb.updateDatastoreEntry(
          query.message.message_id.toString(),
          v => {
            if (v) v.wasPublished = true;
            return v;
          },
        );
        await ctx.deleteMessage();
        if (!res) {
          console.error('Failed to forward message!');
          return;
        }

        if (config.vkRepostConfig) {
          const res2 = await forwardMessageToVk(
            config.vkRepostConfig.groupId,
            config.vkRepostConfig.accessToken,
            ctx,
            query.message,
          );
          console.log(res2);
        }

        await votesDb.saveDatastoreEntry(
          `${res.chat.id}_${res.message_id}`,
          votesInChannel,
        );
      } else {
        await ctx.editMessageReplyMarkup(createVoteMarkup(maybeVotes));
      }
    }

    await ctx.answerCbQuery();
  });
}
