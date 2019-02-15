import Datastore from '@google-cloud/datastore'
import * as dotenv from 'dotenv';
dotenv.load();

// See https://github.com/yagop/node-telegram-bot-api/issues/319
process.env.NTBA_FIX_319 = "X"
import TelegramBot from 'node-telegram-bot-api';
import { DatastoreRequest } from '@google-cloud/datastore/request';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN as string, { polling: true });

const kModeratorChatId = -346184941;
const kNewsChannelId = -1001283746274;
const kVotesToApproveOrReject = 2;

const gDatastore = new Datastore();
const kDatastoreKind = 'MessageVotes';

const kMaxRetries = 10;

class MessageVotes {
  public votesFor: number[] = [];
  public votesAgainst: number[] = [];
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

// Matches "/vote [whatever]"
bot.onText(/^\/ping(.+)/, async (msg, _match) => {
  const chatId = msg.chat.id;
  const res = await bot.sendMessage(chatId, 'Pong!');
  console.log(JSON.stringify(res));
});

// Any text...
bot.onText(/^(.+)/, async (msg) => {
  console.log(`Received message: ${JSON.stringify(msg)}`);
  // ... which is sent privately
  if (msg.chat && msg.chat.type == 'private' && msg.text) {
    const votes = new MessageVotes();
    const res = await bot.sendMessage(kModeratorChatId, msg.text, { reply_markup: createVoteMarkup(votes) });
    await saveDatastoreEntry(gDatastore, `${res.chat.id}_${res.message_id}`, votes);
    console.log(JSON.stringify(res));
  }
});

function recalculateVotes(votes: MessageVotes, userId: number, modifier: string): boolean {
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
        return undefined;
      }
      await saveDatastoreEntry(transaction, dbKey, votes);
      const commitResult = await transaction.commit();
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

