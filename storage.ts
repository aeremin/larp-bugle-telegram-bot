import Datastore from '@google-cloud/datastore'
import { DatastoreRequest } from '@google-cloud/datastore/request';
import { MessageVotes } from './util';

const kDatastoreKind = 'MessageVotes';

export type ModifierFunction = (v: MessageVotes) => boolean;

export interface DatabaseInterface {
  saveDatastoreEntry(dbKey: string, votes: MessageVotes): void;
  readDatastoreEntry(dbKey: string): Promise<MessageVotes>;
  updateDatastoreEntry(dbKey: string, modifier: ModifierFunction): Promise<MessageVotes | undefined>
}

export class DatastoreConnector implements DatabaseInterface {
  private datastore = new Datastore();
  constructor(private maxRetries: number = 10) {}

  public saveDatastoreEntry(dbKey: string, votes: MessageVotes) {
    return this.saveDatastoreEntryImpl(this.datastore, dbKey, votes);
  }

  public readDatastoreEntry(dbKey: string): Promise<MessageVotes> {
    return this.readDatastoreEntryImpl(this.datastore, dbKey);
  }

  public async updateDatastoreEntry(dbKey: string, modifier: ModifierFunction): Promise<MessageVotes | undefined> {
    for (let i = 0; i < this.maxRetries; ++i) {
      try {
        const transaction = this.datastore.transaction();
        await transaction.run();
        const votes = await this.readDatastoreEntryImpl(transaction, dbKey);
        if (!modifier(votes)) {
          await transaction.rollback();
          return undefined;
        }
        await this.saveDatastoreEntryImpl(transaction, dbKey, votes);
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

  private async saveDatastoreEntryImpl(dsInterface: DatastoreRequest | undefined, dbKey: string, votes: MessageVotes) {
    const task = {
      key: this.datastore.key([kDatastoreKind, dbKey]),
      data: votes
    };
    if (!dsInterface)
      dsInterface = this.datastore;
    await dsInterface.save(task);
  }

  private async readDatastoreEntryImpl(dsInterface: DatastoreRequest, dbKey: string): Promise<MessageVotes> {
    console.log('Querying data from Datastore');
    const queryResult = await dsInterface.get(this.datastore.key([kDatastoreKind, dbKey]));
    console.log(`Query result: ${JSON.stringify(queryResult)}`);

    return queryResult[0] as MessageVotes;
  }

}

