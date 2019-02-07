import * as dotenv from 'dotenv';
dotenv.load();

// See https://github.com/yagop/node-telegram-bot-api/issues/319
process.env.NTBA_FIX_319="X"
import * as TelegramBot from 'node-telegram-bot-api';

// TODO: Convert to cloud function:
// 1) Explicitly use express to handle incoming http requests and pass them to the bot
//    https://github.com/yagop/node-telegram-bot-api/issues/649#issuecomment-422845852
// 2) Export express instance so Google Cloud Functions can handle it
//    https://codeburst.io/express-js-on-cloud-functions-for-firebase-86ed26f9144c
const m: TelegramBot.InlineKeyboardMarkup = {
  inline_keyboard: [[
    {
      text: 'Decrease',
      callback_data: '-1',
    },
    {
      text: 'Increase',
      callback_data: '+1',
    },
  ]],
};

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN as string, { polling: true });

// Matches "/vote [whatever]"
bot.onText(/^\/vote (.+)/, async (msg, _match) => {
  // 'msg' is the received Message from Telegram
  // 'match' is the result of executing the regexp above on the text content
  // of the message
  const chatId = msg.chat.id;
  // send back the matched "whatever" to the chat
  const res = await bot.sendMessage(chatId, `Текущее значение: 100`, { reply_markup: m });
  console.log(JSON.stringify(res));
});

// Listen for any kind of message. There are different kinds of
// messages.
bot.on('message', (msg) => {
  console.log(`Received message: ${JSON.stringify(msg)}`);
});

bot.on('callback_query', async (query) => {
  console.log(`Received message: ${JSON.stringify(query)}`);
  if (!query.message || !query.message.text)
    return;

  const currentValue = Number(query.message.text.split(' ')[2]) + Number(query.data);
  await bot.editMessageText(`Текущее значение: ${currentValue}`,
    { reply_markup: m, chat_id: query.message.chat.id, message_id: query.message.message_id });
  await bot.answerCallbackQuery(query.id);
});
