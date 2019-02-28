import Datastore from '@google-cloud/datastore'
import { DatastoreRequest } from '@google-cloud/datastore/request';
import { MessageVotes } from './util';

export const gDatastore = new Datastore();
const kDatastoreKind = 'MessageVotes';

export async function saveDatastoreEntry(dsInterface: DatastoreRequest, messageId: string, votes: MessageVotes) {
  const task = {
    key: gDatastore.key([kDatastoreKind, messageId]),
    data: votes
  };

  await dsInterface.save(task);
}

export async function readDatastoreEntry(dsInterface: DatastoreRequest, messageId: string): Promise<MessageVotes> {
  console.log('Querying data from Datastore');
  const queryResult = await dsInterface.get(gDatastore.key([kDatastoreKind, messageId]));
  console.log(`Query result: ${JSON.stringify(queryResult)}`);
  return queryResult[0] as MessageVotes;
}
