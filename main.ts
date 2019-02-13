import * as dotenv from 'dotenv';
dotenv.load();

// See https://github.com/yagop/node-telegram-bot-api/issues/319
process.env.NTBA_FIX_319 = "X"
import * as TelegramBot from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN as string);
bot.setWebHook('https://europe-west1-alice-larp.cloudfunctions.net/larp-bugle-telegram-bot');

exports.cloudFn = (req: any, res: any) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
};

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


// Example group message
/*
{
  "message_id": 10,
  "from": {
    "id": 238167359,
    "is_bot": false,
    "first_name": "Alexey",
    "last_name": "Eremin",
    "username": "aleremin",
    "language_code": "en"
  },
  "chat": {
    "id": -346184941,
    "title": "larp_bugle_bot_test_group",
    "type": "group",
    "all_members_are_administrators": true
  },
  "date": 1550015816,
  "group_chat_created": true
}
*/

// Example private message
/*
{
  "message_id":7,
  "from": {
    "id": 238167359,
    "is_bot":false,
    "first_name":"Alexey",
    "last_name":"Eremin",
    "username":"aleremin",
    "language_code":"en"
  },
  "chat":{
    "id":238167359,
    "first_name":"Alexey",
    "last_name":"Eremin",
    "username":"aleremin",
    "type":"private"
  },
  "date":1550015571,
  "text":"test"
}
*/