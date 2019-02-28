process.env.TELEGRAM_BOT_MODERATOR_CHAT_ID = "129";

import 'mocha';
import sinon from 'sinon';
import Datastore from '@google-cloud/datastore'
import TelegramBot from 'node-telegram-bot-api';
import { setUpBotBehavior } from './behavior';
import { getConfig } from './config/main';
import { createPrivateMessageUpdate, sleep, kPrivateChatId, microSleep } from './test_helpers';
import { testOnlyReset } from './reporter_state_machine';
import { gDatastore } from './storage';

describe('Behaviour test', () => {
  let bot: TelegramBot;
  let botMocker: sinon.SinonMock;
  const datastoreMocker: sinon.SinonStubbedInstance<Datastore> = sinon.stub(gDatastore);
  const kModeratorChatId = 10;
  const kJunkGroupId = 20;
  const kChannelId = 30;

  beforeEach(() => {
    bot = new TelegramBot("111", {polling: false});
    botMocker = sinon.mock(bot);

    testOnlyReset();

    setUpBotBehavior(bot, {
      ...getConfig(),
      moderatorChatId: kModeratorChatId,
      junkGroupId: kJunkGroupId,
      newsChannelId: kChannelId,
    });
  });

  afterEach(() => {
    botMocker.verify();
  });

  it("Text message without /sendarticle reaction", () => {
    botMocker.expects("sendMessage").withExactArgs(kPrivateChatId, sinon.match(/сначала .*\/sendarticle/));
    bot.processUpdate(createPrivateMessageUpdate('Hello brother'));
  });

  it("/start reaction", () => {
    botMocker.expects("sendMessage").withExactArgs(kPrivateChatId, sinon.match(/Привет.* \/sendarticle/));
    bot.processUpdate(createPrivateMessageUpdate('/start'));
  });

  it("/sendarticle flow - finished", async () => {
    {
      const expectation = botMocker.expects("sendMessage").withExactArgs(kPrivateChatId, sinon.match(/Кидай текст/));
      bot.processUpdate(createPrivateMessageUpdate('/sendarticle'));
      expectation.verify();
    }
    await microSleep();
    {
      const expectation = botMocker.expects("sendMessage").withExactArgs(kPrivateChatId, sinon.match(/готово.*\/yes.*\/no/));
      bot.processUpdate(createPrivateMessageUpdate('Awesome news article: http://example.com'));
      expectation.verify();
    }
    await microSleep();
    {
      const expectation = botMocker.expects("sendMessage").withArgs(kModeratorChatId);
      expectation.returns({chat: {id: kModeratorChatId}, message_id: 13});
      const expectation2 = botMocker.expects("sendMessage").withArgs(kPrivateChatId);
      bot.processUpdate(createPrivateMessageUpdate('/yes'));
      await microSleep();
      expectation.verify();
      expectation2.verify();
    }
  });
});