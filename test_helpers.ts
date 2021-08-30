import { Update } from 'typegram';

let gUpdateId = 0;
let gMessageId = 0;

export const kPrivateChatId = 17;
export const kUserId = 123;
export const kUsername = 'kool_xakep';

export const kModeratorChatId = 18;
export const kModeratorChatMessageId = 27;

export const kChannelId = 40;
export const kChannelMessageId = 41;

export function createPrivateMessageUpdate(text: string): Update {
  return {
    update_id: gUpdateId++,
    message: {
      from: {
        id: kUserId,
        is_bot: false,
        username: kUsername,
        first_name: '',
        last_name: undefined,
      },
      text,
      message_id: gMessageId++,
      date: new Date().valueOf(),
      chat: {
        id: kPrivateChatId,
        type: 'private',
        first_name: ''
      },
    },
  };
}

export function createPrivateImageMessageUpdate(caption: string): Update {
  return {
    update_id: gUpdateId++,
    message: {
      caption,
      photo: [{
        width: 100,
        height: 100,
        file_id: 'abcde',
        file_unique_id: ''
      }],
      from: {
        id: kUserId,
        is_bot: false,
        username: kUsername,
        first_name: '',
        last_name: undefined,
      },
      message_id: gMessageId++,
      date: new Date().valueOf(),
      chat: {
        id: kPrivateChatId,
        type: 'private',
        first_name: '',
      },
    },
  };
}

function createVoteUpdate(userId: number, messageId: number, chatId: number, messageText: string, modifier: '+' | '-'): Update {
  return {
    update_id: gUpdateId++,
    callback_query: {
      id: (gMessageId++).toString(),
      data: modifier,
      from: {
        id: userId,
        is_bot: false,
        first_name: '',
      },
      message: {
        message_id: messageId,
        date: new Date().valueOf(),
        text: messageText,
        chat: {
          id: chatId,
          type: 'group',
          title: '',
        },
      },
      chat_instance: '',
    },
  };
}

export function createModeratorVoteUpdate(userId: number, messageText: string, modifier: '+' | '-'): Update {
  return createVoteUpdate(userId, kModeratorChatMessageId, kModeratorChatId, messageText, modifier);
}

export function createReaderVoteUpdate(userId: number, messageText: string, modifier: '+' | '-'): Update {
  return createVoteUpdate(userId, kChannelMessageId, kChannelId, messageText, modifier);
}

