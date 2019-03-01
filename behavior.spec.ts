process.env.TELEGRAM_BOT_MODERATOR_CHAT_ID = "129";

import 'mocha';
import sinon from 'sinon';
import Datastore from '@google-cloud/datastore'
import TelegramBot from 'node-telegram-bot-api';
import { setUpBotBehavior } from './behavior';
import { getConfig } from './config/config';
import { createPrivateMessageUpdate, sleep, kPrivateChatId, microSleep, kUserId } from './test_helpers';
import { testOnlyReset } from './reporter_state_machine';
import { DatastoreConnector, DatabaseInterface } from './storage';

describe('Behaviour test', () => {
  let bot: TelegramBot;
  let datastore: DatabaseInterface = new DatastoreConnector();
  let botMocker: sinon.SinonMock;
  let datastoreMocker: sinon.SinonMock;
  const kModeratorChatId = 10;
  const kJunkGroupId = 20;
  const kChannelId = 30;

  beforeEach(() => {
    bot = new TelegramBot("111", { polling: false });
    botMocker = sinon.mock(bot);

    testOnlyReset();
    datastoreMocker = sinon.mock(datastore)
    setUpBotBehavior(bot, datastore, {
      ...getConfig(),
      moderatorChatId: kModeratorChatId,
      junkGroupId: kJunkGroupId,
      newsChannelId: kChannelId,
    });
  });

  afterEach(() => {
    botMocker.verify();
    datastoreMocker.verify();
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
      const expectation = botMocker.expects("sendMessage").withArgs(kModeratorChatId, sinon.match('Awesome news article: http://example.com'));
      expectation.returns({ chat: { id: kModeratorChatId }, message_id: 13 });
      const expectation2 = botMocker.expects("sendMessage").withArgs(kPrivateChatId, sinon.match(/отправлена/));
      datastoreMocker.expects("saveDatastoreEntry").withArgs(`${kModeratorChatId}_13`,
        sinon.match({ disallowedToVote: [kUserId], finished: false, votesAgainst: [], votesFor: [] }));
      bot.processUpdate(createPrivateMessageUpdate('/yes'));
      await microSleep();
      expectation.verify();
      expectation2.verify();
    }
  });

  it("/sendarticle flow - cancelled", async () => {
    {
      const expectation = botMocker.expects("sendMessage").withExactArgs(kPrivateChatId, sinon.match(/Кидай текст/));
      bot.processUpdate(createPrivateMessageUpdate('/sendarticle'));
      expectation.verify();
    }
    await microSleep();
    {
      const expectation = botMocker.expects("sendMessage").withExactArgs(kPrivateChatId, sinon.match(/готово.*\/yes.*\/no/));
      bot.processUpdate(createPrivateMessageUpdate('Dumb news article: http://example.com'));
      expectation.verify();
    }
    await microSleep();
    {
      const expectation = botMocker.expects("sendMessage").withArgs(kPrivateChatId, sinon.match(/Отменяю/));
      bot.processUpdate(createPrivateMessageUpdate('/no'));
      await microSleep();
      expectation.verify();
    }
  });
});