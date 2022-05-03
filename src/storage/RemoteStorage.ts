import RemoteStorage = require("remotestoragejs")
import { FEventLog } from "utils";
import { LogStorage } from "./types";

export class RemoteStorageStorage implements LogStorage {
  remoteStorage: RemoteStorage | undefined
  client: any;
  fileName = 'if-log.json'

  constructor() {
    const remoteStorage = new RemoteStorage({
      cache: true,
      logging: true,
    })
    remoteStorage.access.claim('if-pwa', 'rw');
    this.client = remoteStorage.scope('/if-pwa/');
  }
  static isAvailable(): boolean {
    return typeof RemoteStorage === 'undefined'
  }
  load(): Promise<FEventLog> {
    return this.client.getObject(this.fileName).then((r: FEventLog | undefined) => r || []) as Promise<FEventLog>;
  }
  update(log: FEventLog): Promise<void> {
    debugger;
    return this.client.storeObject('if-log', this.fileName, log) as Promise<void>;
  }
}