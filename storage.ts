import Datastore from '@google-cloud/datastore'
import { DatastoreRequest } from '@google-cloud/datastore/request';
import { MessageVotes, UserStats } from './util';

export interface DatabaseInterface<T> {
  saveDatastoreEntry(dbKey: string, entity: T): void;
  readDatastoreEntry(dbKey: string): Promise<T | undefined>;
  updateDatastoreEntry(dbKey: string, modifier: (v: T | undefined) => T | undefined): Promise<T | undefined>
}

class DatastoreConnector<T> implements DatabaseInterface<T> {
  private datastore = new Datastore();
  constructor(private readonly kDatastoreKind, private maxRetries: number = 10) { }

  public saveDatastoreEntry(dbKey: string, entity: T) {
    return this.saveDatastoreEntryImpl(this.datastore, dbKey, entity);
  }

  public readDatastoreEntry(dbKey: string): Promise<T | undefined> {
    return this.readDatastoreEntryImpl(this.datastore, dbKey);
  }

  public async updateDatastoreEntry(dbKey: string, modifier: (v: T | undefined) => T | undefined): Promise<T | undefined> {
    for (let i = 0; i < this.maxRetries; ++i) {
      try {
        const transaction = this.datastore.transaction();
        await transaction.run();
        const entity = await this.readDatastoreEntryImpl(transaction, dbKey);
        if (!modifier(entity) || !entity) {
          await transaction.rollback();
          return undefined;
        }
        await this.saveDatastoreEntryImpl(transaction, dbKey, entity);
        const commitResult = await transaction.commit();
        if (commitResult.length && commitResult[0].mutationResults.length &&
          !commitResult[0].mutationResults[0].conflictDetected)
          return entity;
        console.warn('Retrying because of conflict');
      } catch (e) {
        console.error(`Caught error: ${e}, let's retry`);
      }
    }
    return undefined;
  }

  private async saveDatastoreEntryImpl(dsInterface: DatastoreRequest | undefined, dbKey: string, entity: T) {
    const task = {
      key: this.datastore.key([this.kDatastoreKind, dbKey]),
      data: entity
    };
    if (!dsInterface)
      dsInterface = this.datastore;
    await dsInterface.save(task);
  }

  private async readDatastoreEntryImpl(dsInterface: DatastoreRequest, dbKey: string): Promise<T | undefined> {
    console.log('Querying data from Datastore');
    const queryResult = await dsInterface.get(this.datastore.key([this.kDatastoreKind, dbKey]));
    console.log(`Query result: ${JSON.stringify(queryResult)}`);

    return queryResult[0] ? queryResult[0] as unknown as T : undefined;
  }
}

export class MessageVotesDatabase extends DatastoreConnector<MessageVotes> {
  constructor() {
    super('MessageVotes');
  }
}

export class UserStatsDatabase extends DatastoreConnector<UserStats> {
  constructor() {
    super('UserStats');
  }
}
