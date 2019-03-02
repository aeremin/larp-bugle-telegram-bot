process.env.TELEGRAM_BOT_MODERATOR_CHAT_ID = "129";

import 'mocha';
import sinon from 'sinon';
import Datastore from '@google-cloud/datastore'
import TelegramBot from 'node-telegram-bot-api';
import { setUpBotBehavior } from './behavior';
import { getConfig } from './config/config';
import { createPrivateMessageUpdate, sleep, kPrivateChatId, microSleep, kUserId, kModeratorChatMessageId, kModeratorChatId, createPrivateImageMessageUpdate, createModeratorVoteUpdate, createReaderVoteUpdate, kChannelId, kChannelMessageId } from './test_helpers';
import { testOnlyReset } from './reporter_state_machine';
import { DatastoreConnector, DatabaseInterface, ModifierFunction } from './storage';
import { MessageVotes } from './util';
import { expect } from 'chai';

describe('Behaviour test', () => {
  let bot: TelegramBot;
  let datastore: DatabaseInterface = new DatastoreConnector();
  let botMocker: sinon.SinonMock;
  let datastoreMocker: sinon.SinonMock;
  const kJunkGroupId = 20;

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

  describe('Reporter interaction', () => {
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

    it("/sendarticle flow with image - finished", async () => {
      {
        const expectation = botMocker.expects("sendMessage").withExactArgs(kPrivateChatId, sinon.match(/Кидай текст/));
        bot.processUpdate(createPrivateMessageUpdate('/sendarticle'));
        expectation.verify();
      }
      await microSleep();
      {
        const expectation = botMocker.expects("sendMessage").withExactArgs(kPrivateChatId, sinon.match(/готово.*\/yes.*\/no/));
        bot.processUpdate(createPrivateImageMessageUpdate('Awesome picture'));
        expectation.verify();
      }
      await microSleep();
      {
        const expectation = botMocker.expects("sendPhoto").withArgs(kModeratorChatId, sinon.match.any, sinon.match({ caption: 'Awesome picture'}));
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

  describe('Moderator interaction', () => {
    it("Got positive votes, posting to news channel", async () => {
      const votes: MessageVotes = { disallowedToVote: [], votesFor: [], votesAgainst: [], finished: false };
      datastoreMocker.expects('updateDatastoreEntry').twice().callsFake(
        (_: string, modifier: ModifierFunction) => modifier(votes) ? votes : undefined);

      botMocker.expects("editMessageReplyMarkup").withExactArgs(sinon.match.any,
        { chat_id: kModeratorChatId, message_id: kModeratorChatMessageId });
      botMocker.expects("answerCallbackQuery").twice();

      bot.processUpdate(createModeratorVoteUpdate(1, 'Good news article', '+'));
      await microSleep();
      expect(votes).to.deep.equal({ disallowedToVote: [], votesFor: [1], votesAgainst: [], finished: false });

      botMocker.expects("sendMessage")
        .withArgs(kChannelId, sinon.match('Good news article'), sinon.match({ reply_markup: {} }))
        .returns({ chat: { id: 999 }, message_id: 111 });
      botMocker.expects("deleteMessage").withArgs(kModeratorChatId, kModeratorChatMessageId.toString());

      datastoreMocker.expects("saveDatastoreEntry").withArgs('999_111',
        sinon.match({ disallowedToVote: [], finished: false, votesAgainst: [], votesFor: [] }));

      bot.processUpdate(createModeratorVoteUpdate(2, 'Good news article', '+'));
      await microSleep();
      expect(votes).to.deep.equal({ disallowedToVote: [], votesFor: [1, 2], votesAgainst: [], finished: true });
    });

    it("Got negative votes, posting to junk group", async () => {
      const votes: MessageVotes = { disallowedToVote: [], votesFor: [], votesAgainst: [], finished: false };
      datastoreMocker.expects('updateDatastoreEntry').twice().callsFake(
        (_: string, modifier: ModifierFunction) => modifier(votes) ? votes : undefined);

      botMocker.expects("editMessageReplyMarkup").withExactArgs(sinon.match.any,
        { chat_id: kModeratorChatId, message_id: kModeratorChatMessageId });
      botMocker.expects("answerCallbackQuery").twice();

      bot.processUpdate(createModeratorVoteUpdate(1, 'Bad news article', '-'));
      await microSleep();
      expect(votes).to.deep.equal({ disallowedToVote: [], votesFor: [], votesAgainst: [1], finished: false });

      botMocker.expects("sendMessage").withArgs(kJunkGroupId, sinon.match('Bad news article'));
      botMocker.expects("deleteMessage").withArgs(kModeratorChatId, kModeratorChatMessageId.toString());

      bot.processUpdate(createModeratorVoteUpdate(2, 'Bad news article', '-'));
      await microSleep();
      expect(votes).to.deep.equal({ disallowedToVote: [], votesFor: [], votesAgainst: [1, 2], finished: true });
    });
  });

  describe('Reader interaction', () => {
    it("Many readers can vote", async () => {
      const votes: MessageVotes = { disallowedToVote: [], votesFor: [], votesAgainst: [], finished: false };
      datastoreMocker.expects('updateDatastoreEntry').thrice().callsFake(
        (_: string, modifier: ModifierFunction) => modifier(votes) ? votes : undefined);
      botMocker.expects("editMessageReplyMarkup").thrice().withExactArgs(sinon.match.any,
          { chat_id: kChannelId, message_id: kChannelMessageId });
      botMocker.expects("answerCallbackQuery").thrice();

      bot.processUpdate(createReaderVoteUpdate(1, 'Bad news article', '-'));
      expect(votes).to.deep.equal({ disallowedToVote: [], votesFor: [], votesAgainst: [1], finished: false });

      bot.processUpdate(createReaderVoteUpdate(2, 'Bad news article', '-'));
      expect(votes).to.deep.equal({ disallowedToVote: [], votesFor: [], votesAgainst: [1, 2], finished: false });

      bot.processUpdate(createReaderVoteUpdate(3, 'Bad news article', '-'));
      expect(votes).to.deep.equal({ disallowedToVote: [], votesFor: [], votesAgainst: [1, 2, 3], finished: false });
    })
  });
});