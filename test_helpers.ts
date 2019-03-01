import TelegramBot from 'node-telegram-bot-api';

let gUpdateId = 0;
let gMessageId = 0;

export const kPrivateChatId = 17;
export const kUserId = 123;

export const kModeratorChatId = 18;
export const kModeratorChatMessageId = 27;
export const kModeratorChatMessageDbKey = `${kModeratorChatId}_${kModeratorChatMessageId}`;

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

export function createPrivateImageMessageUpdate(caption: string): TelegramBot.Update {
  return {
    update_id: gUpdateId++,
    message: {
      caption,
      photo: [{
        width: 100,
        height: 100,
        file_id: 'abcde'
      }],
      from: {
        id: kUserId,
        is_bot: false,
        first_name: ""
      },
      message_id: gMessageId++,
      date: new Date().valueOf(),
      chat: {
        id: kPrivateChatId,
        type: 'private'
      }
    }
  };
}


export function createVoteUpdate(userId: number, messageText: string, modifier: '+' | '-'): TelegramBot.Update {
  return {
    update_id: gUpdateId++,
    callback_query: {
      id: (gMessageId++).toString(),
      data: modifier,
      from: {
        id: userId,
        is_bot: false,
        first_name: ""
      },
      message: {
        message_id: kModeratorChatMessageId,
        date: new Date().valueOf(),
        text: messageText,
        chat: {
          id: kModeratorChatId,
          type: 'group'
        }
      },
      chat_instance: ""
    }
  };
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function microSleep() {
  return sleep(1);
}