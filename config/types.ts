export type BotMessages = {
  HELLO_MESSAGE: string,
  SEND_ARTICLE_NOW: string,
  ARTICLE_WAITING_FOR_APPROVAL: string,
  NEED_SEND_ARTICLE_CMD: string,
  NEED_ARTICLE_TEXT: string,
  THANK_YOU_FOR_ARTICLE: string,
  ARTICLE_SEND_WAS_CANCELLED: string,
  ARTICLE_REQUEST_APPROVAL: string,
};

export type BotConfig = {
  textMessages: BotMessages,
  tag: string | undefined,
};
