import 'mocha';
import { expect } from 'chai';
import { preprocessMessageBeforeApproval, createVoteMarkup, MessageVotes, recalculateVotes } from './util';
import lodash from 'lodash';

describe('Utils tests', () => {
  describe('preprocessMessageBeforeApproval', () => {
    it('Returns message if no tag provided', () => {
      expect(preprocessMessageBeforeApproval("Hello world!", undefined)).equals("Hello world!");
    });

    it('Concatenates tag if provided', () => {
      expect(preprocessMessageBeforeApproval("Hello world!", "#example")).equals("Hello world!\n#example");
    });
  });

  describe('createVoteMarkup', () => {
    it('Returns 2 buttons with proper numbers', () => {
      const keyboard = createVoteMarkup({votesFor: [1, 2, 3], votesAgainst: [4], disallowedToVote: [], finished: false}).inline_keyboard;
      expect(keyboard).lengthOf(1);
      const buttons = keyboard[0];
      expect(buttons).lengthOf(2);
      const forButton = buttons[0];
      expect(forButton.text).contains('3');
      expect(forButton.callback_data).equals('+');

      const againstButton = buttons[1];
      expect(againstButton.text).contains('1');
      expect(againstButton.callback_data).equals('-');
    });
  });

  describe('recalculateVotes', () => {
    const votes: MessageVotes = {votesFor: [1, 2, 3], votesAgainst: [4], disallowedToVote: [6, 7], finished: false}

    it("Returns false and doesn't modify votes if disallowed to vote", () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 7, '+');
      expect(success).to.be.false;
      expect(maybeModifiedVotes).to.deep.equal(votes);
    });

    it("Returns false and doesn't modify votes if already voted for", () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 2, '+');
      expect(success).to.be.false;
      expect(maybeModifiedVotes).to.deep.equal(votes);
    });

    it("Returns false and doesn't modify votes if already voted against", () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 4, '-');
      expect(success).to.be.false;
      expect(maybeModifiedVotes).to.deep.equal(votes);
    });

    it("Returns true and adds vote for", () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 10, '+');
      expect(success).to.be.true;
      expect(maybeModifiedVotes).to.deep.equal({...votes, votesFor: [1, 2, 3, 10], finished: true});
    });

    it("Returns true and adds vote against", () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 10, '-');
      expect(success).to.be.true;
      expect(maybeModifiedVotes).to.deep.equal({...votes, votesAgainst: [4, 10], finished: true});
    });

    it("Returns true moves vote to for", () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 4, '+');
      expect(success).to.be.true;
      expect(maybeModifiedVotes).to.deep.equal({...votes, votesFor: [1, 2, 3, 4], votesAgainst: [], finished: true});
    });

    it("Returns true moves vote to against", () => {
      const maybeModifiedVotes = lodash.cloneDeep(votes);
      const success = recalculateVotes(maybeModifiedVotes, 2, '-');
      expect(success).to.be.true;
      expect(maybeModifiedVotes).to.deep.equal({...votes, votesFor: [1, 3], votesAgainst: [4, 2], finished: true});
    });
  });
});
