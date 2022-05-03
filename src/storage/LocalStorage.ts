import { FEventLog } from "utils";
import { LogStorage } from "./types";

export class LocalStorage implements LogStorage {
  key = 'log';

  load(): Promise<FEventLog> {
    const content = localStorage.getItem(this.key);
    if (content) {
      const log = JSON.parse(content);
      if (log) {
        return Promise.resolve(log)
      }
    }
    return Promise.resolve([]);
  }

  update(log: FEventLog): Promise<void> {
    const content = JSON.stringify(log);
    localStorage.setItem(this.key, content);
    return Promise.resolve();
  }
  isAvailable(): boolean {return true;}
}