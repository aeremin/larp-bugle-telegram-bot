import Datastore from '@google-cloud/datastore'
import * as dotenv from 'dotenv';
dotenv.load();

// See https://github.com/yagop/node-telegram-bot-api/issues/319
process.env.NTBA_FIX_319 = "X"
import TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN as string, { polling: true });

const kModeratorChatId = -346184941;
const kNewsChannelId = -1001283746274;
const kVotesToApproveOrReject = 1;

const gDatastore = new Datastore();
const kDatastoreKind = 'MessageVotes';

class MessageVotes {
  public votesFor: number[] = [];
  public votesAgainst: number[] = [];
}

async function saveDatastoreEntry(messageId: string, votes: MessageVotes) {
  const task = {
    key: gDatastore.key([kDatastoreKind, messageId]),
    data: votes
  };

  try {
    await gDatastore.save(task);
    console.log(`Saved ${task.key.name}`);
  } catch (err) {
    console.error('ERROR:', err);
  }
}

async function readDatastoreEntry(messageId: string): Promise<MessageVotes> {
  console.log('Querying data from Datastore');
  const queryResult = await gDatastore.get(gDatastore.key([kDatastoreKind, messageId]));
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
    await saveDatastoreEntry(`${res.chat.id}_${res.message_id}`, votes);
    console.log(JSON.stringify(res));
  }
});

bot.on('callback_query', async (query) => {
  console.log(`Received query: ${JSON.stringify(query)}`);
  if (!query.message || !query.message.text)
    return;

  const dbKey = `${query.message.chat.id}_${query.message.message_id}`;
  const votes = await readDatastoreEntry(dbKey);
  console.log(`Current votes: ${JSON.stringify(votes)}`);
  const userId = query.from.id;
  if (query.data == '+') {
    if (!votes.votesFor.includes(userId)) {
      votes.votesFor.push(userId);
      votes.votesAgainst = votes.votesAgainst.filter(v => v != userId);
    }
  } else if (query.data == '-') {
    if (!votes.votesAgainst.includes(userId)) {
      votes.votesAgainst.push(query.from.id);
      votes.votesFor = votes.votesFor.filter(v => v != userId);
    }
  }
  console.log(`And now votes are: ${JSON.stringify(votes)}`);

  // TODO: Do it in some transactional way
  await saveDatastoreEntry(dbKey, votes);

  if (votes.votesAgainst.length >= kVotesToApproveOrReject) {
    await bot.deleteMessage(query.message.chat.id, query.message.message_id.toString());
  } else if (votes.votesFor.length >= kVotesToApproveOrReject) {
    await bot.sendMessage(kNewsChannelId, query.message.text);
    await bot.deleteMessage(query.message.chat.id, query.message.message_id.toString());
  } else {
    await bot.editMessageReplyMarkup(createVoteMarkup(votes), {chat_id: query.message.chat.id, message_id: query.message.message_id});
  }

  await bot.answerCallbackQuery(query.id);
});

