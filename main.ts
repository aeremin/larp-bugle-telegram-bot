import * as dotenv from 'dotenv';
import { Telegraf } from 'telegraf'
import { Request, Response } from 'express'

import { setUpBotBehavior } from './behavior';
import * as messages from './config/config';
import { MessageVotesDatabase, NewsArticlesDatabase, ReporterStateDatabase, UserStatsDatabase } from './storage';

dotenv.config();

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
setUpBotBehavior(bot, new MessageVotesDatabase(), new UserStatsDatabase(), new NewsArticlesDatabase(), new ReporterStateDatabase(), messages.getConfig());

bot.telegram.setWebhook(process.env.WEBHOOK_URL!).then(() => console.log('Webhook set'));

export const botFunction = async (req: Request, res: Response) => {
  try {
    await bot.handleUpdate(req.body)
  } finally {
    res.status(200).end()
  }
}
