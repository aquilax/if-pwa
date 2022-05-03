import { FEventLog } from "utils";

export interface BackupManager {
  backup(log: FEventLog): string;
  restore(data: string): FEventLog;
}