import * as dotenv from 'dotenv';
import TelegramBot from 'node-telegram-bot-api';
import {setUpBotBehavior} from './behavior';

import * as messages from "./config/config";
import {MessageVotesDatabase, NewsArticlesDatabase, ReporterStateDatabase, UserStatsDatabase} from './storage';

dotenv.config();

// See https://github.com/yagop/node-telegram-bot-api/issues/319
process.env.NTBA_FIX_319 = "X";

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN!, { polling: true });
setUpBotBehavior(bot, new MessageVotesDatabase(), new UserStatsDatabase(), new NewsArticlesDatabase(), new ReporterStateDatabase(), messages.getConfig());



