import Datastore from '@google-cloud/datastore'
import * as dotenv from 'dotenv';
dotenv.load();

// See https://github.com/yagop/node-telegram-bot-api/issues/319
process.env.NTBA_FIX_319 = "X"
import TelegramBot from 'node-telegram-bot-api';
import { DatastoreRequest } from '@google-cloud/datastore/request';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN as string, { polling: true });

const kModeratorChatId = process.env.TELEGRAM_BOT_MODERATOR_CHAT_ID || -1001248047463;
const kNewsChannelId = process.env.TELEGRAM_BOT_NEWS_CHANNEL_ID || -1001168838549;
const kJunkGroupId = process.env.TELEGRAM_BOT_JUNK_CHANNEL_ID || -367143261;
const kVotesToApproveOrReject = 2;

const gDatastore = new Datastore();
const kDatastoreKind = 'MessageVotes';

const kMaxRetries = 10;

type ReporterState = 'start' | 'waiting_message' | 'waiting_approval';

class ReporterStateAndMessage {
  public state: ReporterState = 'start';
  public message?: string;
}

// TODO: Add persistance?
const gReporterStates = new Map<number, ReporterStateAndMessage>();;

class MessageVotes {
  public votesFor: number[] = [];
  public votesAgainst: number[] = [];
  public disallowedToVote: number[] = [];
  public finished = false;
}

async function saveDatastoreEntry(dsInterface: DatastoreRequest, messageId: string, votes: MessageVotes) {
  const task = {
    key: gDatastore.key([kDatastoreKind, messageId]),
    data: votes
  };

  await dsInterface.save(task);
}

async function readDatastoreEntry(dsInterface: DatastoreRequest, messageId: string): Promise<MessageVotes> {
  console.log('Querying data from Datastore');
  const queryResult = await dsInterface.get(gDatastore.key([kDatastoreKind, messageId]));
  console.log(`Query result: ${JSON.stringify(queryResult)}`);
  return queryResult[0] as MessageVotes;
}

function createVoteMarkup(votes: MessageVotes): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      {
        text: `👍 (${votes.votesFor.length})`,
        callback_data: '+',
      },
      {
        text: `👎 (${votes.votesAgainst.length})`,
        callback_data: '-',
      },
    ]],
  }
}

function isPrivateMessage(msg: TelegramBot.Message): boolean {
  return msg.chat && msg.chat.type == 'private';
}

function stateForReporter(msg: TelegramBot.Message): ReporterStateAndMessage {
  return gReporterStates.get((msg.from as TelegramBot.User).id) || new ReporterStateAndMessage();
}

function saveReporterState(msg: TelegramBot.Message, s: ReporterStateAndMessage) {
  gReporterStates.set((msg.from as TelegramBot.User).id, s);
}

// Matches "/vote [whatever]"
bot.onText(/^\/ping(.*)/, async (msg, _match) => {
  const chatId = msg.chat.id;
  const res = await bot.sendMessage(chatId, 'Pong!');
  console.log(JSON.stringify(res));
});

bot.onText(/^\/start(.*)/, async (msg) => {
  if (!isPrivateMessage(msg)) return;
  const chatId = msg.chat.id;
  await bot.sendMessage(chatId, 'Привет, ролевой репортер! Есть что интересного? Жми /sendarticle чтобы отправить РИ новость! Помни, редакторы могут принять не все.');
});

bot.onText(/^\/sendarticle(.*)/, async (msg) => {
  if (!isPrivateMessage(msg)) return;
  const chatId = msg.chat.id;
  const s = stateForReporter(msg);

  if (s.state == 'start' || s.state == 'waiting_message') {
    await bot.sendMessage(chatId, 'Кидай текст новости! Можно включить в него ссылку.');
    s.state = 'waiting_message';
  } else if (s.state == 'waiting_approval') {
    await bot.sendMessage(chatId,
      'Новость уже готова к отправке! Жми /yes чтобы подтвердить отправку или /no чтобы отменить отправку этой новости и предложить другую.');
  }

  saveReporterState(msg, s);
});

bot.onText(/^\/yes(.*)/, async (msg) => {
  if (!isPrivateMessage(msg)) return;

  const chatId = msg.chat.id;
  const s = stateForReporter(msg);
  if (s.state == 'start') {
    await bot.sendMessage(chatId, 'Чтоб отправить новость, сначала нажми /sendarticle.');
  } else if (s.state == 'waiting_message') {
    await bot.sendMessage(chatId, 'Сначала отправь текст новости!');
  } else if (s.state == 'waiting_approval') {
    const votes = new MessageVotes();
    if (msg.from && msg.from.username != 'aleremin') {
      votes.disallowedToVote.push(msg.from.id);
    }
    const res = await bot.sendMessage(kModeratorChatId, s.message as string, { reply_markup: createVoteMarkup(votes) });
    await saveDatastoreEntry(gDatastore, `${res.chat.id}_${res.message_id}`, votes);
    console.log(JSON.stringify(res));
    await bot.sendMessage(chatId, 'Готово! Новость отправлена модераторам. Спасибо за помощь!');
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
  await bot.sendMessage(chatId, 'Понял! Отменяю отправку новости. Жми /sendarticle чтоб отправить другую.');
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
    await bot.sendMessage(chatId, 'Чтоб отправить новость, сначала нажми /sendarticle.');
  } else if (s.state == 'waiting_message') {
    await bot.sendMessage(chatId,
      'Почти готово! Жми /yes чтобы подтвердить отправку или /no чтобы отменить отправку этой новости и предложить другую. ' +
      'Если нужно - можно отредактировать сообщение с предложенной новостью до нажатия /yes.');
    s.state = 'waiting_approval';
    s.message = msg.text;
  } else if (s.state == 'waiting_approval') {
  }

  saveReporterState(msg, s);
});

bot.on('message', async (msg) => {
  if (!isPrivateMessage(msg)) return;
  console.debug(JSON.stringify(msg));
});

function recalculateVotes(votes: MessageVotes, userId: number, modifier: string): boolean {
  if (votes.disallowedToVote.includes(userId))
    return false;

  if (modifier == '+') {
    if (!votes.votesFor.includes(userId)) {
      votes.votesFor.push(userId);
      votes.votesAgainst = votes.votesAgainst.filter(v => v != userId);
      votes.finished = votes.votesFor.length >= kVotesToApproveOrReject;
      return true;
    }
  } else if (modifier == '-') {
    if (!votes.votesAgainst.includes(userId)) {
      votes.votesAgainst.push(userId);
      votes.votesFor = votes.votesFor.filter(v => v != userId);
      votes.finished = votes.votesAgainst.length >= kVotesToApproveOrReject;
      return true;
    }
  }
  return false;
}

// Returns undefined iff failed to update votes (user already participated in the vote, vote cancelled, ...).
async function processVotesUpdate(dbKey: string, userId: number, modifier: string | undefined): Promise<MessageVotes | undefined> {
  let votes = new MessageVotes();
  for (let i = 0; i < kMaxRetries; ++i) {
    try {
      const transaction = gDatastore.transaction();
      await transaction.run();
      votes = await readDatastoreEntry(transaction, dbKey);
      if (!modifier || votes.finished || !recalculateVotes(votes, userId, modifier)) {
        await transaction.rollback();
        return undefined;
      }
      await saveDatastoreEntry(transaction, dbKey, votes);
      const commitResult = await transaction.commit();
      console.log(`Commit result: ${JSON.stringify(commitResult)}`);
      if (commitResult.length && commitResult[0].mutationResults.length &&
        !commitResult[0].mutationResults[0].conflictDetected)
        return votes;
      console.warn('Retrying because of conflict');
    } catch (e) {
      console.error(`Caught error: ${e}, let's retry`);
    }
  }
  return undefined;
}

bot.on('callback_query', async (query) => {
  console.log(`Received query: ${JSON.stringify(query)}`);
  if (!query.message || !query.message.text)
    return;

  const dbKey = `${query.message.chat.id}_${query.message.message_id}`;
  const maybeVotes = await processVotesUpdate(dbKey, query.from.id, query.data);
  if (maybeVotes) {
    if (maybeVotes.votesAgainst.length >= kVotesToApproveOrReject) {
      await bot.sendMessage(kJunkGroupId, query.message.text);
      await bot.deleteMessage(query.message.chat.id, query.message.message_id.toString());
    } else if (maybeVotes.votesFor.length >= kVotesToApproveOrReject) {
      await bot.sendMessage(kNewsChannelId, query.message.text);
      await bot.deleteMessage(query.message.chat.id, query.message.message_id.toString());
    } else {
      await bot.editMessageReplyMarkup(createVoteMarkup(maybeVotes),
        {chat_id: query.message.chat.id, message_id: query.message.message_id});
    }
  }

  await bot.answerCallbackQuery(query.id);
});

