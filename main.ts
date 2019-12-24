import * as dotenv from 'dotenv';
dotenv.load();

// See https://github.com/yagop/node-telegram-bot-api/issues/319
process.env.NTBA_FIX_319 = "X"
import TelegramBot from 'node-telegram-bot-api';

import * as messages from "./config/config";
import { setUpBotBehavior } from './behavior';
import { MessageVotesDatabase, UserStatsDatabase, NewsArticlesDatabase } from './storage';

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN as string, { polling: true });
setUpBotBehavior(bot,  new MessageVotesDatabase(), new UserStatsDatabase(), new NewsArticlesDatabase(), messages.getConfig());

