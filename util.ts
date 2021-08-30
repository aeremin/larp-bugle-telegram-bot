import { Message, User, InlineKeyboardMarkup } from 'typegram'

export function preprocessMessageBeforeApproval(messageText: string | undefined, tag: string | undefined): string {
  if (!messageText)
    messageText = '';
  if (tag) {
    return `${messageText}\n${tag}`;
  } else {
    return messageText;
  }
}

export function createVoteMarkup(votes: MessageVotes): InlineKeyboardMarkup {
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
  };
}

export class MessageVotes {
  // ID is {chat_id}_{message_id}.
  // Therefore there is no relation between message on moderation stage (in moderator's chat)
  // and "same" message in public channel. Their votes  are completely separate.
  public votesFor: number[] = [];
  public votesAgainst: number[] = [];

  // At the moment only used to prevent moderators from submitting their post
  // for moderation and (dis)approving it.
  public disallowedToVote: number[] = [];

  public finished = false;
}

export class UserStats {
  // ID is {user_id}_{user_nickname}. Which is rather bad
  // as user nickname can change. Most probably user_nickname should
  // go into separate field.
  public articlesProposed = 0;
  // Number of votes in the moderator chat.
  public votesAsModerator = 0;
  // Number of votes in public channel.
  public votesAsReader = 0;
}

export interface NewsArticle {
  // ID is the message_id in the moderator (!) chat.
  submitterId: number;
  submitterName: string;
  submissionTime: Date;
  wasPublished: boolean;
  text: string;
}

export type Vote = '+' | '-';

export function recalculateVotes(votes: MessageVotes, userId: number, vote: Vote, votesLimits: { votesToApprove: number, votesToReject: number }): boolean {
  if (votes.finished)
    return false;
  if (votes.disallowedToVote.includes(userId))
    return false;

  if (vote == '+') {
    if (!votes.votesFor.includes(userId)) {
      votes.votesFor.push(userId);
      votes.votesAgainst = votes.votesAgainst.filter(v => v != userId);
      votes.finished = votes.votesFor.length >= votesLimits.votesToApprove;
      return true;
    }
  } else if (vote == '-') {
    if (!votes.votesAgainst.includes(userId)) {
      votes.votesAgainst.push(userId);
      votes.votesFor = votes.votesFor.filter(v => v != userId);
      votes.finished = votes.votesAgainst.length >= votesLimits.votesToReject;
      return true;
    }
  }
  return false;
}

export function dbKeyForUser(user: User): string {
  return `${user.id}_${user.username}`;
}

export function extractFirstUrl(msg: string): string | undefined {
  const httpRe = /(http|ftp|https):\/\/([\w_-]+(?:(?:\.[\w_-]+)+))([\w.,@?^=%&:/~+#-]*[\w@?^=%&/~+#-])?/;
  const reMatch = msg.match(httpRe);
  if (reMatch) {
    return reMatch[0];
  } else {
    return undefined;
  }
}

type ReporterState = 'start' | 'waiting_message' | 'waiting_approval';

export interface ReporterStateAndMessage {
  state: ReporterState;
  message?: Message.TextMessage | Message.PhotoMessage;
}
