type Timestamp = number;
type State = "fasting" | "eating";
type FEvent = {
  ts: Timestamp;
  start: State;
};
type FEventLog = Array<FEvent>;

const EATING: State = "eating";
const FASTING: State = "fasting";
const FASTING_INDEX = 0;
const EATING_INDEX = 1;
const ENTRIES_TO_SHOW = 10;
const HOUR = 3600 * 1000;

const fastInterval = [16, 8]; // fast, eat

const getTs = (d: Date): Timestamp => d.getTime();
const getNow = (): Timestamp => getTs(new Date());
const fEvent = (ts: Timestamp, start: State): FEvent => ({ ts, start });
const twoDigitPad = (num: number) => num < 10 ? "0" + num : num;
const getTime = (ts: Timestamp) => {
  const date = new Date(ts);
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();
  return `${twoDigitPad(hour)}:${twoDigitPad(minute)}:${twoDigitPad(second)}`;
}

const formatTs = (ts: Timestamp): string => {
  const date = new Date(ts);

  const day = date.getDate();
  const month = date.getMonth();
  const year = date.getFullYear();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return `${year}-${twoDigitPad(month+1)}-${twoDigitPad(day)} ${twoDigitPad(hour)}:${twoDigitPad(minute)}:${twoDigitPad(second)}`
}

const getLocaleDateTime = (ts: Timestamp): string => {
  const d = new Date(ts);
  return (new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()).slice(0, -8); // remove timezone, ms and s
}

/**
 * Returns the last event before the now timestamp or null
 * Expects log to be sorted in chronological order
 */
const findLastEvent = (log: FEventLog, now: Timestamp): FEvent | null => {
  let lastEvent = null;
  let lastTs = null;
  const paddedLog = [{ ts: -1, start: EATING }, ...log]; // add sentinel
  for (let i = paddedLog.length - 1; i >= 0; i--) {
    if (lastTs === null) {
      lastTs = paddedLog[i].ts;
      continue;
    }
    if (paddedLog[i].ts <= now && lastTs <= now) {
      return paddedLog[i + 1];
    }
    lastTs = paddedLog[i].ts;
  }
  return lastEvent;
};
/**
 * Returns the state at timestamp `now` given the ordered `log`
 */
const getState = (log: FEventLog, now: Timestamp): State => {
  const lastEvent = findLastEvent(log, now);
  if (lastEvent) {
    return lastEvent.start;
  }
  return EATING;
};

/**
 * Returns the next FEvent given timestamp `now` and ordered `log`
 */
const getTargetEvent = (log: FEventLog, now: Timestamp): FEvent | null => {
  const lastEvent = findLastEvent(log, now);
  if (lastEvent) {
    if (lastEvent.start === FASTING) {
      return fEvent(lastEvent.ts + fastInterval[FASTING_INDEX]*HOUR, EATING);
    }
    return fEvent(lastEvent.ts + fastInterval[EATING_INDEX]*HOUR, FASTING);
  }
  return null;
};


const getLogEntry = (template: HTMLTemplateElement, event: FEvent): Element => {
  var clone = template.content.cloneNode(true) as HTMLElement;
  const entry = (clone.querySelector('.entry') as HTMLElement)
  entry.dataset.ts = event.ts.toString(10);
  entry.classList.add(event.start);
  (clone.querySelector('time') as HTMLElement).innerText = formatTs(event.ts);
  (clone.querySelector('.message') as HTMLElement).innerText = `Started ${event.start}`;
  (clone.querySelector('.timeEdit') as HTMLInputElement).value = getLocaleDateTime(event.ts);
  return clone
}

const formatEvent = (e: FEvent): string => `${formatTs(e.ts)}\t${e.start}`;
const formatLog = (log: FEventLog): string =>log.map(formatEvent).join("\n");

interface BackupManager {
  backup(log: FEventLog): string;
  restore(data: string): FEventLog;
}

class BackupManagerV1 implements BackupManager {
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

interface LogStorage {
  load(): Promise<FEventLog>;
  update(log: FEventLog): Promise<void>;
}

class MemoryStorage implements LogStorage {
  storage: FEventLog = [];

  load(): Promise<FEventLog> {
    return Promise.resolve(this.storage);
  }

  update(log: FEventLog): Promise<void> {
    this.storage = log;
    return Promise.resolve();
  }
}

class IndexDBStorage implements LogStorage {
  dbName = 'log';
  dbVersion = 1;

  load(): Promise<FEventLog> {
    return Promise.reject('not implemented');
  }
  update(_log: FEventLog): Promise<void> {
    return Promise.reject('not implemented');
  }
}

class LocalStorageStorage implements LogStorage {
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
}

class App {
  targetEvent: FEvent | null = null;
  storage: LogStorage;
  backupManager: BackupManager;
  global: Window;
  $log: HTMLTextAreaElement;
  $status: HTMLDivElement;
  $progress: HTMLDivElement;
  $logList: HTMLOListElement
  $entryTemplate: HTMLTemplateElement;
  updateInterval: number

  constructor(storage: LogStorage, backupManager: BackupManager, global: Window) {
    this.storage = storage;
    this.backupManager = backupManager;
    this.global = global;
    this.$log = global.document.querySelector<HTMLTextAreaElement>("#log")!;
    this.$status = global.document.querySelector<HTMLDivElement>("#status")!;
    this.$progress = global.document.querySelector<HTMLDivElement>("#progress")!;
    this.$logList = global.document.querySelector<HTMLOListElement>("#logList")!;
    this.$entryTemplate = global.document.querySelector<HTMLTemplateElement>("#logEntry")!;
    this.updateProgress = this.updateProgress.bind(this);

    // start update timer
    this.updateInterval = setInterval(this.updateProgress, 1000);

    // Global click handler
    global.document.addEventListener("click", (e: MouseEvent) => {
      const target = e.target as HTMLButtonElement | null;
      if (target) {
        // Log event
        if (target.matches('#logEvent')) {
          e.preventDefault();
          const ts = getNow();
          return this.onLogEvent(ts);
        }
        // Open edit
        if (target.matches('.edit') || target.matches('.editCancel')) {
          e.preventDefault();
          const parent = target.closest('.entry') as HTMLDivElement | null;
          if (parent) {
            parent.querySelector('.editEvent')!.classList.toggle('hidden');
          }
        }
        // Open delete
        if (target.matches('.delete') || target.matches('.deleteCancel')) {
          e.preventDefault();
          const parent = target.closest('.entry') as HTMLDivElement | null;
          if (parent) {
            parent.querySelector('.deleteEvent')!.classList.toggle('hidden');
          }
        }
        // Save edit
        if (target.matches('.editConfirm')) {
          e.preventDefault();
          const parent = target.closest('.entry') as HTMLDivElement | null;
          if (parent && parent.dataset.ts) {
            const ts = parseInt(parent.dataset.ts, 10) as Timestamp;
            const timeEdit = target.parentElement?.querySelector('.timeEdit') as HTMLInputElement;
            if (timeEdit) {
              const newTime = timeEdit.value;
              const newTs = getTs(new Date(`${newTime}:00`));
              this.updateLog(ts, newTs)
                .then(() => parent.querySelector('.editEvent')!.classList.toggle('hidden'))
            }
          }
        }
        // Delete confirm
        if (target.matches('.deleteConfirm')) {
          e.preventDefault();
          const parent = target.closest('.entry') as HTMLDivElement | null;
          if (parent && parent.dataset.ts) {
            const ts = parseInt(parent.dataset.ts, 10) as Timestamp;
            this.deleteLogEntry(ts);
          }
        }
        // Backup
        if (target.matches('#backup')) {
          this.storage.load().then((log) => {
            const text = this.backupManager.backup(log);
            const shareData = {text, title: 'IF Export'};
            if (typeof navigator.share === 'function' && navigator.canShare && navigator.canShare(shareData)) {
              navigator.share(shareData).catch(console.error)
            } else {
              this.$log.value = text
            }
          })
        }
        // Backup to File
        if (target.matches('#backupFile')) {
          this.storage.load().then((log) => {
            const text = this.backupManager.backup(log);
            const exportName = 'if-log.json';
            var dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(text);
            var downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute('href', dataStr);
            downloadAnchorNode.setAttribute('download', exportName);
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
          })
        }
        // Restore
        if (target.matches('#restore')) {
          if (this.global.confirm('Are you sure you want to restore data from the textbox?')) {
            const text = this.$log.value;
            const log = this.backupManager.restore(text);
            const sortedLog = [...log].sort((a, b) => a.ts - b.ts)
            this.storage.update(sortedLog).then(() => {
              this.render(sortedLog, getNow());
            })
          }
        }
      }
    })
  }

  async onLogEvent(ts: Timestamp): Promise<void> {
    const log = await this.storage.load();
    const lastEvent = findLastEvent(log, ts);
    const targetEvent = getTargetEvent(log, ts);
    if (targetEvent)  {
      if (targetEvent.ts > ts && targetEvent.start === EATING) {
        if (!this.global.confirm('There is still time left. Are you sure?')) {
          return Promise.resolve();
        }
      }
    }
    if (lastEvent) {
      const newStart = lastEvent.start == FASTING ? EATING : FASTING;
      log.push(fEvent(ts, newStart));
    } else {
      log.push(fEvent(ts, FASTING));
    }
    await this.storage.update(log);
    this.render(log, getNow());
  }

  async updateLog(ts: Timestamp, newTs: Timestamp): Promise<void> {
    const log = await this.storage.load();
    const newLog = log
      .map((event: FEvent) => event.ts === ts ? {...event, ts: newTs} : event);
    const sortedLog = [...newLog].sort((a, b) => a.ts - b.ts)
    await this.storage.update(sortedLog);
    this.render(sortedLog, getNow());
  }

  async deleteLogEntry(ts: Timestamp): Promise<void> {
    const log = await this.storage.load();
    const newLog = log.flatMap((event: FEvent) => event.ts === ts ? [] : [event]);
    const sortedLog = [...newLog].sort((a, b) => a.ts - b.ts)
    await this.storage.update(sortedLog);
    this.render(sortedLog, getNow());
  }

  updateProgress():void {
    const now = getNow();
    if (this.targetEvent) {
      const msLeft = this.targetEvent.ts - now;
      const hourIndex = this.targetEvent.start === EATING ? FASTING_INDEX : EATING_INDEX;
      const msTotal = fastInterval[hourIndex] * HOUR
      const x = 100 - Math.floor(msLeft/(msTotal/100));
      const percent = x > 100 ? 100 : x
      this.$progress.style.width = `${percent}%`;
      if (x >=100) {
        this.$progress.classList.add('green');
      }
      this.$progress.setAttribute('title', `${(msLeft / HOUR).toFixed(2)} hours left`)
    }
  }

  render(log:FEventLog, ts: Timestamp): void {
    this.$log.value = formatLog(log);
    const targetEvent = getTargetEvent(log, ts);
    this.targetEvent = targetEvent;
    if (targetEvent) {
      this.updateProgress(); // manual update after load
      this.$status.innerText = `Next: ${formatEvent(targetEvent)}`;
    }
    if (log) {
      // clean all children
      this.$logList.replaceChildren();
      // render last ENTRIES_TO_SHOW
      log.slice(-ENTRIES_TO_SHOW).reverse().forEach(event => {
        this.$logList.appendChild(getLogEntry(this.$entryTemplate, event));
      });
    }
  }

  async run() {
    const log = await this.storage.load();
    this.render(log, getNow());
  }
}

window.addEventListener('load', () => {
  new App(new LocalStorageStorage(), new BackupManagerV1(), window).run();
})
