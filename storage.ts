import Datastore from '@google-cloud/datastore'
import { DatastoreRequest } from '@google-cloud/datastore/request';

const kDatastoreKind = 'MessageVotes';

export interface DatabaseInterface {
  saveDatastoreEntry<T>(dbKey: string, votes: T): void;
  readDatastoreEntry<T>(dbKey: string): Promise<T>;
  updateDatastoreEntry<T>(dbKey: string, modifier: (v: T) => boolean): Promise<T | undefined>
}

export class DatastoreConnector implements DatabaseInterface {
  private datastore = new Datastore();
  constructor(private maxRetries: number = 10) {}

  public saveDatastoreEntry<T>(dbKey: string, votes: T) {
    return this.saveDatastoreEntryImpl(this.datastore, dbKey, votes);
  }

  public readDatastoreEntry<T>(dbKey: string): Promise<T> {
    return this.readDatastoreEntryImpl(this.datastore, dbKey);
  }

  public async updateDatastoreEntry<T>(dbKey: string, modifier: (v: T) => boolean): Promise<T | undefined> {
    for (let i = 0; i < this.maxRetries; ++i) {
      try {
        const transaction = this.datastore.transaction();
        await transaction.run();
        const votes = await this.readDatastoreEntryImpl<T>(transaction, dbKey);
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

  private async saveDatastoreEntryImpl<T>(dsInterface: DatastoreRequest | undefined, dbKey: string, votes: T) {
    const task = {
      key: this.datastore.key([kDatastoreKind, dbKey]),
      data: votes
    };
    if (!dsInterface)
      dsInterface = this.datastore;
    await dsInterface.save(task);
  }

  private async readDatastoreEntryImpl<T>(dsInterface: DatastoreRequest, dbKey: string): Promise<T> {
    console.log('Querying data from Datastore');
    const queryResult = await dsInterface.get(this.datastore.key([kDatastoreKind, dbKey]));
    console.log(`Query result: ${JSON.stringify(queryResult)}`);

    return queryResult[0] as unknown as T;
  }
}

