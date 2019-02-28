import * as normal from "./normal";
import * as gdesra4 from "./gdesra4";

export type BotConfig = {
  textMessages: normal.BotMessages,
  tag: string | undefined,
  moderatorChatId: number,
  newsChannelId: number,
  junkGroupId: number,
};

export function getConfig(): BotConfig {
  const commonConfig = {
    moderatorChatId: Number(process.env.TELEGRAM_BOT_MODERATOR_CHAT_ID),
    newsChannelId: Number(process.env.TELEGRAM_BOT_NEWS_CHANNEL_ID),
    junkGroupId: Number(process.env.TELEGRAM_BOT_JUNK_CHANNEL_ID)
  }
  if (process.env.CONFIG_MODE === "gdesra4") {
    return {
        ...commonConfig,
        textMessages: gdesra4.getMessages(),
        tag: "#ПодгонАнонимуса",
    };
  } else {
    return {
        ...commonConfig,
        textMessages: normal.getMessages(),
        tag: undefined,
    };
  }
}
