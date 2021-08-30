import lodash from 'lodash';
import {
  createVoteMarkup,
  extractFirstUrl,
  MessageVotes,
  preprocessMessageBeforeApproval,
  recalculateVotes,
} from './util';

describe('Utils tests', () => {
  describe('preprocessMessageBeforeApproval', () => {
    it('Returns message if no tag provided', () => {
      expect(preprocessMessageBeforeApproval('Hello world!', undefined)).toBe('Hello world!');
    });

    it('Concatenates tag if provided', () => {
      expect(preprocessMessageBeforeApproval('Hello world!', '#example')).toBe('Hello world!\n#example');
    });
  });

  describe('createVoteMarkup', () => {
    it('Returns 2 buttons with proper numbers', () => {
      const keyboard = createVoteMarkup({
        votesFor: [1, 2, 3],
        votesAgainst: [4],
        disallowedToVote: [],
        finished: false,
      }).inline_keyboard;
      expect(keyboard).toHaveLength(1);
      const buttons = keyboard[0];
      expect(buttons).toHaveLength(2);
      const forButton = buttons[0];
      expect(forButton.text).toContain('3');
      expect(forButton).toMatchObject({callback_data: '+'});

      const againstButton = buttons[1];
      expect(againstButton.text).toContain('1');
      expect(againstButton).toMatchObject({callback_data: '-'});
    });
  });

  // TODO: Add better tests for votes.finished calculation
  describe('recalculateVotes', () => {
    const votes: MessageVotes = { votesFor: [1, 2, 3], votesAgainst: [4], disallowedToVote: [6, 7], finished: false };

    it('Returns false and doesn\'t modify votes if disallowed to vote', () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 7, '+', { votesToApprove: 2, votesToReject: 2 });
      expect(success).toBe(false);
      expect(maybeModifiedVotes).toEqual(votes);
    });

    it('Returns false and doesn\'t modify votes if already voted for', () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 2, '+', { votesToApprove: 2, votesToReject: 2 });
      expect(success).toBe(false);
      expect(maybeModifiedVotes).toEqual(votes);
    });

    it(
      'Returns false and doesn\'t modify votes if already voted against',
      () => {
        const maybeModifiedVotes = lodash.cloneDeep(votes);
        const success = recalculateVotes(maybeModifiedVotes, 4, '-', { votesToApprove: 2, votesToReject: 2 });
        expect(success).toBe(false);
        expect(maybeModifiedVotes).toEqual(votes);
      }
    );

    it('Returns true and adds vote for', () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 10, '+', { votesToApprove: 2, votesToReject: 2 });
      expect(success).toBe(true);
      expect(maybeModifiedVotes).toEqual({ ...votes, votesFor: [1, 2, 3, 10], finished: true });
    });

    it('Returns true and adds vote against', () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 10, '-', { votesToApprove: 2, votesToReject: 2 });
      expect(success).toBe(true);
      expect(maybeModifiedVotes).toEqual({ ...votes, votesAgainst: [4, 10], finished: true });
    });

    it('Returns true moves vote to for', () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 4, '+', { votesToApprove: 2, votesToReject: 2 });
      expect(success).toBe(true);
      expect(maybeModifiedVotes).toEqual({ ...votes, votesFor: [1, 2, 3, 4], votesAgainst: [], finished: true });
    });

    it('Returns true moves vote to against', () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 2, '-', { votesToApprove: 2, votesToReject: 2 });
      expect(success).toBe(true);
      expect(maybeModifiedVotes).toEqual({ ...votes, votesFor: [1, 3], votesAgainst: [4, 2], finished: true });
    });
  });

  describe('extractFirstUrl', () => {
    it('Can extract normal link', () => {
      expect(
        extractFirstUrl('Something whatever http://example.com/foo magic pony')).toBe('http://example.com/foo');
    });

    it('Can extract link in parenthesis', () => {
      expect(
        extractFirstUrl('Something whatever (http://example.com/foo) magic pony')).toBe('http://example.com/foo');
    });

    it('Can extract link in the end of line', () => {
      expect(
        extractFirstUrl('Something whatever http://example.com/foo')).toBe('http://example.com/foo');
    });
  });
});
