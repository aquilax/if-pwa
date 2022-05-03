import { createStore, get, set, UseStore } from 'idb-keyval';
import { FEventLog } from "utils";
import { LogStorage } from "./types";

export class IndexDBStorage implements LogStorage {
  dbName = 'if-log';
  dbStoreName = 'if-log-v1';
  dbObject = 'log';
  customStore: UseStore;

  constructor() {
    this.customStore = createStore(this.dbName, this.dbStoreName);
  }

  load(): Promise<FEventLog> {
    return get(this.dbObject, this.customStore).then((value: unknown) => value ?? []) as Promise<FEventLog>
  }

  update(log: FEventLog): Promise<any> {
    return set(this.dbObject, log, this.customStore);
  }

  static isAvailable(): boolean {return typeof indexedDB !== 'undefined';}
}