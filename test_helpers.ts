import TelegramBot from 'node-telegram-bot-api';

let gUpdateId = 0;
let gMessageId = 0;

export const kPrivateChatId = 17;
export const kUserId = 123;

export function createPrivateMessageUpdate(text: string): TelegramBot.Update {
  return {
    update_id: gUpdateId++,
    message: {
      from: {
        id: kUserId,
        is_bot: false,
        first_name: ""
      },
      text,
      message_id: gMessageId++,
      date: new Date().valueOf(),
      chat: {
        id: kPrivateChatId,
        type: 'private'
      }
    }
  };
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function microSleep() {
  return sleep(1);
}