import { FEventLog } from "utils";
import { LogStorage } from "./types";

export class MemoryStorage implements LogStorage {
  storage: FEventLog = [];

  load(): Promise<FEventLog> {
    return Promise.resolve(this.storage);
  }

  update(log: FEventLog): Promise<void> {
    this.storage = log;
    return Promise.resolve();
  }

  static isAvailable(): boolean {return true;}
}