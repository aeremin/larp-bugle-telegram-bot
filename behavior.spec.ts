process.env.TELEGRAM_BOT_MODERATOR_CHAT_ID = '129';

import sinon from 'sinon';
import { Telegraf } from 'telegraf';
import { setUpBotBehavior } from './behavior';
import { getConfig } from './config/config';
import { DatabaseInterface, MessageVotesDatabase, NewsArticlesDatabase, UserStatsDatabase } from './storage';
import {
  createModeratorVoteUpdate,
  createPrivateImageMessageUpdate,
  createPrivateMessageUpdate,
  createReaderVoteUpdate,
  kChannelId,
  kChannelMessageId,
  kModeratorChatId,
  kModeratorChatMessageId,
  kPrivateChatId,
  kUserId,
} from './test_helpers';
import { MessageVotes, NewsArticle, ReporterStateAndMessage, UserStats } from './util';

class InMemoryReporterState implements DatabaseInterface<ReporterStateAndMessage> {
  private storage: { [key: string]: ReporterStateAndMessage } = {};

  public async readDatastoreEntry(dbKey: string): Promise<ReporterStateAndMessage | undefined> {
    return this.storage[dbKey];
  }

  public async saveDatastoreEntry(dbKey: string, entity: ReporterStateAndMessage): Promise<void> {
    this.storage[dbKey] = entity;
  }

  public async updateDatastoreEntry(dbKey: string, modifier: (v: (ReporterStateAndMessage | undefined)) => (ReporterStateAndMessage | undefined)): Promise<ReporterStateAndMessage | undefined> {
    throw new Error('not implemented');
  }
}

describe('Behaviour test', () => {
  let bot: Telegraf;
  let datastoreVotes: DatabaseInterface<MessageVotes> = new MessageVotesDatabase();
  let datastoreStats: DatabaseInterface<UserStats> = new UserStatsDatabase();
  let datastoreArticles: DatabaseInterface<NewsArticle> = new NewsArticlesDatabase();

  let botMocker: sinon.SinonMock;

  let votesDatastoreMocker: sinon.SinonMock;
  let statsDatastoreMocker: sinon.SinonMock;
  let articlesDatastoreMocker: sinon.SinonMock;

  const kJunkGroupId = 20;

  beforeEach(() => {
    bot = new Telegraf('111');
    bot.telegram.callApi = ((method, data) => {}) as any;
    // @ts-ignore
    bot.context.tg = bot.telegram
    botMocker = sinon.mock(bot.telegram);

    votesDatastoreMocker = sinon.mock(datastoreVotes);
    statsDatastoreMocker = sinon.mock(datastoreStats);
    articlesDatastoreMocker = sinon.mock(datastoreArticles);
    setUpBotBehavior(bot, datastoreVotes, datastoreStats, datastoreArticles, new InMemoryReporterState(), {
      ...getConfig(),
      moderatorChatId: kModeratorChatId,
      junkGroupId: kJunkGroupId,
      newsChannelId: kChannelId,
    });
  });

  afterEach(() => {
    botMocker.verify();
    votesDatastoreMocker.verify();
    statsDatastoreMocker.verify();
    articlesDatastoreMocker.verify();
  });

  describe('Reporter interaction', () => {
    it('Text message without /sendarticle reaction', async () => {
      const expectation = botMocker.expects('sendMessage').withArgs(kPrivateChatId, sinon.match(/сначала .*\/sendarticle/));
      await bot.handleUpdate(createPrivateMessageUpdate('Hello brother'));
      expectation.verify();
    });

    it('/start reaction', async () => {
      const expectation = botMocker.expects('sendMessage').withArgs(kPrivateChatId, sinon.match(/Привет.* \/sendarticle/));
      await bot.handleUpdate(createPrivateMessageUpdate('/start'));
      expectation.verify();
    });

    it('/sendarticle flow - finished', async () => {
      {
        const expectation = botMocker.expects('sendMessage').withExactArgs(kPrivateChatId, sinon.match(/Кидай текст/));
        await bot.handleUpdate(createPrivateMessageUpdate('/sendarticle'));
        expectation.verify();
      }
      {
        const expectation = botMocker.expects('sendMessage').withExactArgs(kPrivateChatId, sinon.match(/готово.*\/yes.*\/no/));
        await bot.handleUpdate(createPrivateMessageUpdate('Awesome news article: http://example.com'));
        expectation.verify();
      }
      {
        const expectation = botMocker.expects('sendMessage').withArgs(kModeratorChatId, sinon.match('Awesome news article: http://example.com'));
        expectation.returns({ chat: { id: kModeratorChatId }, message_id: 13 });
        const expectation2 = botMocker.expects('sendMessage').withArgs(kPrivateChatId, sinon.match(/отправлена/));
        votesDatastoreMocker.expects('saveDatastoreEntry').withArgs(`${kModeratorChatId}_13`,
          sinon.match({ disallowedToVote: [kUserId], finished: false, votesAgainst: [], votesFor: [] }));
        statsDatastoreMocker.expects('updateDatastoreEntry');
        articlesDatastoreMocker.expects('saveDatastoreEntry').withArgs('13',
          sinon.match({
            submitterId: kUserId,
            submitterName: 'kool_xakep ( undefined)',
            wasPublished: false,
            text: 'Awesome news article: http://example.com',
          }));
        await bot.handleUpdate(createPrivateMessageUpdate('/yes'));
        expectation.verify();
        expectation2.verify();
      }
    });

    it('/sendarticle flow with image - finished', async () => {
      {
        const expectation = botMocker.expects('sendMessage').withExactArgs(kPrivateChatId, sinon.match(/Кидай текст/));
        await bot.handleUpdate(createPrivateMessageUpdate('/sendarticle'));
        expectation.verify();
      }
      {
        const expectation = botMocker.expects('sendMessage').withExactArgs(kPrivateChatId, sinon.match(/готово.*\/yes.*\/no/));
        await bot.handleUpdate(createPrivateImageMessageUpdate('Awesome picture'));
        expectation.verify();
      }
      {
        const expectation = botMocker.expects('sendPhoto').withArgs(kModeratorChatId, sinon.match.any, sinon.match({ caption: 'Awesome picture' }));
        expectation.returns({ chat: { id: kModeratorChatId }, message_id: 13 });
        const expectation2 = botMocker.expects('sendMessage').withArgs(kPrivateChatId, sinon.match(/отправлена/));
        votesDatastoreMocker.expects('saveDatastoreEntry').withArgs(`${kModeratorChatId}_13`,
          sinon.match({ disallowedToVote: [kUserId], finished: false, votesAgainst: [], votesFor: [] }));
        statsDatastoreMocker.expects('updateDatastoreEntry');
        articlesDatastoreMocker.expects('saveDatastoreEntry').withArgs('13',
          sinon.match({
            submitterId: kUserId,
            submitterName: 'kool_xakep ( undefined)',
            wasPublished: false,
            text: 'Awesome picture',
          }));

        await bot.handleUpdate(createPrivateMessageUpdate('/yes'));
        expectation.verify();
        expectation2.verify();
      }
    });

    it('/sendarticle flow - cancelled', async () => {
      {
        const expectation = botMocker.expects('sendMessage').withExactArgs(kPrivateChatId, sinon.match(/Кидай текст/));
        await bot.handleUpdate(createPrivateMessageUpdate('/sendarticle'));
        expectation.verify();
      }
      {
        const expectation = botMocker.expects('sendMessage').withExactArgs(kPrivateChatId, sinon.match(/готово.*\/yes.*\/no/));
        await bot.handleUpdate(createPrivateMessageUpdate('Dumb news article: http://example.com'));
        expectation.verify();
      }
      {
        const expectation = botMocker.expects('sendMessage').withArgs(kPrivateChatId, sinon.match(/Отменяю/));
        await bot.handleUpdate(createPrivateMessageUpdate('/no'));
        expectation.verify();
      }
    });
  });

  describe('Moderator interaction', () => {
    it('Got positive votes, posting to news channel', async () => {
      const votes: MessageVotes = new MessageVotes();
      votesDatastoreMocker.expects('updateDatastoreEntry').twice().callsFake(
        (_: string, modifier) => modifier(votes) ? votes : undefined);
      statsDatastoreMocker.expects('updateDatastoreEntry').twice();

      botMocker.expects('editMessageReplyMarkup').once().withExactArgs(kModeratorChatId, kModeratorChatMessageId, undefined, sinon.match.any);
      botMocker.expects('answerCbQuery').twice();

      await bot.handleUpdate(createModeratorVoteUpdate(1, 'Good news article', '+'));
      expect(votes).toEqual({ disallowedToVote: [], votesFor: [1], votesAgainst: [], finished: false });

      botMocker.expects('sendMessage')
        .withArgs(kChannelId, sinon.match('Good news article'), sinon.match({ reply_markup: {} }))
        .returns({ chat: { id: 999 }, message_id: 111 });
      botMocker.expects('deleteMessage').withArgs(kModeratorChatId, kModeratorChatMessageId);

      votesDatastoreMocker.expects('saveDatastoreEntry').withArgs('999_111',
        sinon.match({ disallowedToVote: [], finished: false, votesAgainst: [], votesFor: [] }));
      articlesDatastoreMocker.expects('updateDatastoreEntry');

      await bot.handleUpdate(createModeratorVoteUpdate(2, 'Good news article', '+'));
      expect(votes).toEqual(
        { disallowedToVote: [], votesFor: [1, 2], votesAgainst: [], finished: true }
      );
    });

    it('Got negative votes, posting to junk group', async () => {
      const votes: MessageVotes = { disallowedToVote: [], votesFor: [], votesAgainst: [], finished: false };
      votesDatastoreMocker.expects('updateDatastoreEntry').thrice().callsFake(
        (_: string, modifier) => modifier(votes) ? votes : undefined);
      statsDatastoreMocker.expects('updateDatastoreEntry').thrice();

      botMocker.expects('editMessageReplyMarkup').twice().withExactArgs(kModeratorChatId, kModeratorChatMessageId, undefined, sinon.match.any);
      botMocker.expects('answerCbQuery').thrice();

      await bot.handleUpdate(createModeratorVoteUpdate(1, 'Bad news article', '-'));
      expect(votes).toEqual({ disallowedToVote: [], votesFor: [], votesAgainst: [1], finished: false });

      botMocker.expects('sendMessage').withArgs(kJunkGroupId, sinon.match('Bad news article'));
      botMocker.expects('deleteMessage').withArgs(kModeratorChatId, kModeratorChatMessageId);

      await bot.handleUpdate(createModeratorVoteUpdate(2, 'Bad news article', '-'));
      expect(votes).toEqual(
        { disallowedToVote: [], votesFor: [], votesAgainst: [1, 2], finished: false }
      );

      await bot.handleUpdate(createModeratorVoteUpdate(3, 'Bad news article', '-'));
      expect(votes).toEqual(
        { disallowedToVote: [], votesFor: [], votesAgainst: [1, 2, 3], finished: true }
      );
    });
  });

  describe('Reader interaction', () => {
    it('Many readers can vote', async () => {
      const votes: MessageVotes = new MessageVotes();
      votesDatastoreMocker.expects('updateDatastoreEntry').thrice().callsFake(
        (_: string, modifier) => modifier(votes) ? votes : undefined);
      botMocker.expects('editMessageReplyMarkup').thrice().withExactArgs(kChannelId, kChannelMessageId, undefined, sinon.match.any);
      botMocker.expects('answerCbQuery').thrice();
      statsDatastoreMocker.expects('updateDatastoreEntry').thrice();

      await bot.handleUpdate(createReaderVoteUpdate(1, 'Bad news article', '-'));
      expect(votes).toEqual({ disallowedToVote: [], votesFor: [], votesAgainst: [1], finished: false });

      await bot.handleUpdate(createReaderVoteUpdate(2, 'Bad news article', '-'));
      expect(votes).toEqual(
        { disallowedToVote: [], votesFor: [], votesAgainst: [1, 2], finished: false }
      );

      await bot.handleUpdate(createReaderVoteUpdate(3, 'Bad news article', '-'));
      expect(votes).toEqual(
        { disallowedToVote: [], votesFor: [], votesAgainst: [1, 2, 3], finished: false }
      );
    });
  });
});
