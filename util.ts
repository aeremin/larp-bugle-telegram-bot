import TelegramBot from 'node-telegram-bot-api';

export function preprocessMessageBeforeApproval(messageText: string | undefined, tag: string | undefined): string {
  if (!messageText)
    messageText = '';
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

export class UserStats {
  public articlesProposed = 0;
  public votesAsModerator = 0;
  public votesAsReader = 0;
}

export type Vote = '+' | '-';

export function recalculateVotes(votes: MessageVotes, userId: number, vote: Vote, maxVotes: number): boolean {
  if (votes.finished)
    return false;
  if (votes.disallowedToVote.includes(userId))
    return false;

  if (vote == '+') {
    if (!votes.votesFor.includes(userId)) {
      votes.votesFor.push(userId);
      votes.votesAgainst = votes.votesAgainst.filter(v => v != userId);
      votes.finished = votes.votesFor.length >= maxVotes;
      return true;
    }
  } else if (vote == '-') {
    if (!votes.votesAgainst.includes(userId)) {
      votes.votesAgainst.push(userId);
      votes.votesFor = votes.votesFor.filter(v => v != userId);
      votes.finished = votes.votesAgainst.length >= maxVotes;
      return true;
    }
  }
  return false;
}

export function dbKeyForUser(user: TelegramBot.User): string {
  return `${user.id}_${user.username}`;
}

export function extractFirstUrl(msg: string): string | undefined {
  const httpRe = /(http|ftp|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?/;
  const reMatch = msg.match(httpRe);
  if (reMatch) {
    return reMatch[0]
  } else {
    return undefined;
  }
}