import {BotMessages} from './types';
import * as normal from './normal';


// tslint:disable:max-line-length
export function getMessages(): BotMessages {
    return {
        ...normal.getMessages(),
    };
}