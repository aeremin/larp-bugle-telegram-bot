import {BotMessages, BotConfig} from './types';
import * as normal from './normal';
import * as gdesra4 from './gdesra4';

export type BotConfig = BotConfig;

export function getConfig(): BotConfig {
    if (process.env.CONFIG_MODE == 'gdesra4'){
        return {
            text: gdesra4.getMessages(),
            tag: '#ПодгонАнонимуса',
        };
    }
    else {
        return {
            text: normal.getMessages(),
            tag: undefined,
        };
    }
}
