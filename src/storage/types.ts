import { FEventLog } from "utils";

export interface LogStorage {
  load(): Promise<FEventLog>;
  update(log: FEventLog): Promise<void>;
}
