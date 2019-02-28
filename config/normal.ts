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

// tslint:disable:max-line-length
export function getMessages(): BotMessages {
    return {
    HELLO_MESSAGE:
    'Привет, ролевой репортер! Есть что интересного? Жми /sendarticle чтобы отправить РИ новость! Помни, редакторы могут принять не все.',
    SEND_ARTICLE_NOW:
    'Кидай текст новости! Можно включить в него ссылку.',
    ARTICLE_WAITING_FOR_APPROVAL:
    'Новость уже готова к отправке! Жми /yes чтобы подтвердить отправку или /no чтобы отменить отправку этой новости и предложить другую.',
    NEED_SEND_ARTICLE_CMD:
    'Чтоб отправить новость, сначала нажми /sendarticle.',
    NEED_ARTICLE_TEXT:
    'Сначала отправь текст новости!',
    THANK_YOU_FOR_ARTICLE:
    'Готово! Новость отправлена модераторам. Спасибо за помощь!',
    ARTICLE_SEND_WAS_CANCELLED:
    'Понял! Отменяю отправку новости. Жми /sendarticle чтоб отправить другую.',
    ARTICLE_REQUEST_APPROVAL:
    'Почти готово! Жми /yes чтобы подтвердить отправку или /no чтобы отменить отправку этой новости и предложить другую. ' +
    'Если нужно - можно отредактировать сообщение с предложенной новостью до нажатия /yes.'
    };
}
