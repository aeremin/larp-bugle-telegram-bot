import Datastore from '@google-cloud/datastore'
import { DatastoreRequest } from '@google-cloud/datastore/request';
import { MessageVotes } from './util';

export const gDatastore = new Datastore();
const kDatastoreKind = 'MessageVotes';
const kMaxRetries = 10;

export async function saveDatastoreEntry(dsInterface: DatastoreRequest, dbKey: string, votes: MessageVotes) {
  const task = {
    key: gDatastore.key([kDatastoreKind, dbKey]),
    data: votes
  };

  await dsInterface.save(task);
}

export async function readDatastoreEntry(dsInterface: DatastoreRequest, dbKey: string): Promise<MessageVotes> {
  console.log('Querying data from Datastore');
  const queryResult = await dsInterface.get(gDatastore.key([kDatastoreKind, dbKey]));
  console.log(`Query result: ${JSON.stringify(queryResult)}`);

  return queryResult[0] as MessageVotes;
}

export type ModifierFunction = (v: MessageVotes) => boolean;

export async function updateDatastoreEntry(dbKey: string, modifier: ModifierFunction): Promise<MessageVotes | undefined> {
  for (let i = 0; i < kMaxRetries; ++i) {
    try {
      const transaction = gDatastore.transaction();
      await transaction.run();
      const votes = await readDatastoreEntry(transaction, dbKey);
      if (!modifier(votes)) {
        await transaction.rollback();
        return undefined;
      }
      await saveDatastoreEntry(transaction, dbKey, votes);
      const commitResult = await transaction.commit();
      if (commitResult.length && commitResult[0].mutationResults.length &&
        !commitResult[0].mutationResults[0].conflictDetected)
        return votes;
      console.warn('Retrying because of conflict');
    } catch (e) {
      console.error(`Caught error: ${e}, let's retry`);
    }
  }
  return undefined;
}


