import TelegramBot from 'node-telegram-bot-api';

export const kVotesToApproveOrReject = 2;

export function preprocessMessageBeforeApproval(messageText: string, tag: string | undefined): string {
  if (tag) {
    return `${messageText}\n${tag}`;
  } else {
    return messageText;
  }
}

export function createVoteMarkup(votes: MessageVotes): TelegramBot.InlineKeyboardMarkup {
  return {
    inline_keyboard: [[
      {
        text: `👍 (${votes.votesFor.length})`,
        callback_data: '+',
      },
      {
        text: `👎 (${votes.votesAgainst.length})`,
        callback_data: '-',
      },
    ]],
  }
}

export class MessageVotes {
  public votesFor: number[] = [];
  public votesAgainst: number[] = [];
  public disallowedToVote: number[] = [];
  public finished = false;
}


export function recalculateVotes(votes: MessageVotes, userId: number, modifier: string): boolean {
  if (votes.disallowedToVote.includes(userId))
    return false;

  if (modifier == '+') {
    if (!votes.votesFor.includes(userId)) {
      votes.votesFor.push(userId);
      votes.votesAgainst = votes.votesAgainst.filter(v => v != userId);
      votes.finished = votes.votesFor.length >= kVotesToApproveOrReject;
      return true;
    }
  } else if (modifier == '-') {
    if (!votes.votesAgainst.includes(userId)) {
      votes.votesAgainst.push(userId);
      votes.votesFor = votes.votesFor.filter(v => v != userId);
      votes.finished = votes.votesAgainst.length >= kVotesToApproveOrReject;
      return true;
    }
  }
  return false;
}