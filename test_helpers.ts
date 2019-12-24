import TelegramBot from 'node-telegram-bot-api';

let gUpdateId = 0;
let gMessageId = 0;

export const kPrivateChatId = 17;
export const kUserId = 123;
export const kUsername = "kool_xakep";

export const kModeratorChatId = 18;
export const kModeratorChatMessageId = 27;
export const kModeratorChatMessageDbKey = `${kModeratorChatId}_${kModeratorChatMessageId}`;

export const kChannelId = 40;
export const kChannelMessageId = 41;

export function createPrivateMessageUpdate(text: string): TelegramBot.Update {
  return {
    update_id: gUpdateId++,
    message: {
      from: {
        id: kUserId,
        is_bot: false,
        username: kUsername,
        first_name: "",
        last_name: undefined,
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
        username: kUsername,
        first_name: "",
        last_name: undefined,
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


function createVoteUpdate(userId: number, messageId: number, chatId: number, messageText: string, modifier: '+' | '-'): TelegramBot.Update {
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
        message_id: messageId,
        date: new Date().valueOf(),
        text: messageText,
        chat: {
          id: chatId,
          type: 'group'
        }
      },
      chat_instance: ""
    }
  };
}

export function createModeratorVoteUpdate(userId: number, messageText: string, modifier: '+' | '-'): TelegramBot.Update {
  return createVoteUpdate(userId, kModeratorChatMessageId, kModeratorChatId, messageText, modifier);
}

export function createReaderVoteUpdate(userId: number, messageText: string, modifier: '+' | '-'): TelegramBot.Update {
  return createVoteUpdate(userId, kChannelMessageId, kChannelId, messageText, modifier);
}

export function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function microSleep() {
  return sleep(1);
}