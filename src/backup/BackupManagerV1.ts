import { FEvent, FEventLog, getTs } from "utils";
import { BackupManager } from "./types";

export class BackupManagerV1 implements BackupManager {
  version = 1;

  backup(log: FEventLog): string {
    return JSON.stringify({
      version: this.version,
      events: log.map((e: FEvent) => ({...e, ts: new Date(e.ts).toISOString()}))
    }, null, 2);
  }

  restore(text: string): FEventLog {
    const {version, events} = JSON.parse(text);
    if (version !== this.version) {
      throw new Error('incorrect backup version');
    }
    return events.map((e: FEvent) => ({...e, ts: getTs(new Date(e.ts))}));
  }
}