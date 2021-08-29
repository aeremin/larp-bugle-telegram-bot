import * as gdesra4 from './gdesra4';
import * as normal from './normal';

export type VkRepostConfig = {
  groupId: number,
  accessToken: string,
}

export type BotConfig = {
  textMessages: normal.BotMessages,
  tag: string | undefined,
  moderatorChatId: number,
  newsChannelId: number,
  junkGroupId: number,
  vkRepostConfig: VkRepostConfig | undefined
};

function getVkRepostConfig(): VkRepostConfig | undefined {
  if (process.env.VK_ACCESS_TOKEN && process.env.VK_GROUP_ID) {
    return {
      groupId: Number(process.env.VK_GROUP_ID),
      accessToken: process.env.VK_ACCESS_TOKEN,
    };
  }
  return undefined;
}

export function getConfig(): BotConfig {
  const commonConfig = {
    moderatorChatId: Number(process.env.TELEGRAM_BOT_MODERATOR_CHAT_ID),
    newsChannelId: Number(process.env.TELEGRAM_BOT_NEWS_CHANNEL_ID),
    junkGroupId: Number(process.env.TELEGRAM_BOT_JUNK_CHANNEL_ID),
    vkRepostConfig: getVkRepostConfig(),
  };
  if (process.env.CONFIG_MODE === 'gdesra4') {
    return {
      ...commonConfig,
      textMessages: gdesra4.getMessages(),
      tag: '#ПодгонАнонимуса',
    };
  } else {
    return {
      ...commonConfig,
      textMessages: normal.getMessages(),
      tag: undefined,
    };
  }
}
