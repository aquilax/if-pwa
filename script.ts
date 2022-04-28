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
const HOUR = 3600 * 1000;

const fastInterval = [16, 8]; // fast, eat

const getNow = (): Timestamp => new Date().getTime();;
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

  return `${year}-${twoDigitPad(month)}-${twoDigitPad(day)} ${twoDigitPad(hour)}:${twoDigitPad(minute)}:${twoDigitPad(second)}`
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


const formatEvent = (e: FEvent): string => `${formatTs(e.ts)}\t${e.start}`;
const formatLog = (log: FEventLog): string =>log.map(formatEvent).join("\n");

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
  update(log: FEventLog): Promise<void> {
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
  global: Window;
  $log: HTMLTextAreaElement;
  $logEvent: HTMLButtonElement;
  $status: HTMLDivElement;
  $progress: HTMLDivElement;
  $logList: HTMLOListElement
  updateInterval: number

  constructor(storage: LogStorage, global: Window) {
    this.storage = storage;
    this.global = global;
    this.$log = global.document.querySelector<HTMLTextAreaElement>("#log")!;
    this.$logEvent =
      global.document.querySelector<HTMLButtonElement>("#logEvent")!;
    this.$logEvent.addEventListener("click", (e: MouseEvent) => {
      e.preventDefault();
      const ts = getNow();
      this.onLogEvent(ts);
    });
    this.$status = global.document.querySelector<HTMLDivElement>("#status")!;
    this.$progress = global.document.querySelector<HTMLDivElement>("#progress")!;
    this.$logList = global.document.querySelector<HTMLOListElement>("#loglist")!;
    this.updateProgress = this.updateProgress.bind(this);
    this.updateInterval = setInterval(this.updateProgress, 10000);
  }

  async onLogEvent(ts: Timestamp): Promise<void> {
    const log = await this.storage.load();
    const lastEvent = findLastEvent(log, ts);
    if (lastEvent) {
      const newStart = lastEvent.start == FASTING ? EATING : FASTING;
      log.push(fEvent(ts, newStart));
    } else {
      log.push(fEvent(ts, FASTING));
    }
    await this.storage.update(log);
    this.render(log);
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
      this.$progress.setAttribute('title', `${(msLeft / HOUR).toFixed(2)} hours left`)
    }
  }

  render(log:FEventLog, ts: Timestamp = getNow()): void {
    this.$log.value = formatLog(log);
    const targetEvent = getTargetEvent(log, ts);
    this.targetEvent = targetEvent;
    if (targetEvent) {
      this.updateProgress(); // manual update after load
      this.$status.innerText = `Next: ${formatEvent(targetEvent)}`;
    }
    this.$logList.innerHTML = log.map(fEvent =>
      `<li>
        <time>${formatTs(fEvent.ts)}</time>
        Started ${fEvent.start}
        <span class="control">
          <button class="edit">✎</button>
          <button class="delete">✖</button>
        <span>
        <div class="editEvent hidden">
          <label>
            Edit time:
            <input type="time" value="${getTime(fEvent.ts)}" />
          </label>
          <button class="editConfirm">✓</button>
          <button class="editCancel">✖</button>
        </div>
        <div class="deleteEvent hidden">
          Are you sure you want to delete this event?
          <button class="deleteConfirm">✓</button>
          <button class="deleteCancel">✖</button>
        </div>
      </li>`).join("\n")
  }

  async run() {
    const log = await this.storage.load();
    this.render(log);
  }
}

new App(new LocalStorageStorage(), window).run();
