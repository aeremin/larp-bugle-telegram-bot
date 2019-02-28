import TelegramBot from 'node-telegram-bot-api';

type ReporterState = 'start' | 'waiting_message' | 'waiting_approval';

class ReporterStateAndMessage {
  public state: ReporterState = 'start';
  public message?: string;
}

// TODO: Add persistance?
const gReporterStates = new Map<number, ReporterStateAndMessage>();;

export function stateForReporter(msg: TelegramBot.Message): ReporterStateAndMessage {
  return gReporterStates.get((msg.from as TelegramBot.User).id) || new ReporterStateAndMessage();
}

export function saveReporterState(msg: TelegramBot.Message, s: ReporterStateAndMessage) {
  gReporterStates.set((msg.from as TelegramBot.User).id, s);
}