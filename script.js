"use strict";
const EATING = "eating";
const FASTING = "fasting";
const FASTING_INDEX = 0;
const EATING_INDEX = 1;
const HOUR = 3600 * 1000;
const fastInterval = [16, 8]; // fast, eat
const log = [
    { ts: 0, start: EATING },
    { ts: 10, start: FASTING },
];
const getNow = () => new Date().getTime();
;
const fEvent = (ts, start) => ({ ts, start });
const twoDigitPad = (num) => num < 10 ? "0" + num : num;
const formatTs = (ts) => {
    const date = new Date(ts);
    const day = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();
    return `${year}-${twoDigitPad(month)}-${twoDigitPad(day)} ${twoDigitPad(hour)}:${twoDigitPad(minute)}:${twoDigitPad(second)}`;
};
/**
 * Returns the last event before the now timestamp or null
 * Expects log to be sorted in chronological order
 */
const findLastEvent = (log, now) => {
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
const getState = (log, now) => {
    const lastEvent = findLastEvent(log, now);
    if (lastEvent) {
        return lastEvent.start;
    }
    return EATING;
};
/**
 * Returns the next FEvent given timestamp `now` and ordered `log`
 */
const getTargetEvent = (log, now) => {
    const lastEvent = findLastEvent(log, now);
    if (lastEvent) {
        if (lastEvent.start === FASTING) {
            return fEvent(lastEvent.ts + fastInterval[FASTING_INDEX] * HOUR, EATING);
        }
        return fEvent(lastEvent.ts + fastInterval[EATING_INDEX] * HOUR, FASTING);
    }
    return null;
};
const formatEvent = (e) => `${formatTs(e.ts)}\t${e.start}`;
const formatLog = (log) => log.map(formatEvent).join("\n");
class MemoryStorage {
    constructor() {
        this.storage = [];
    }
    load() {
        return Promise.resolve(this.storage);
    }
    update(log) {
        this.storage = log;
        return Promise.resolve();
    }
}
class IndexDBStorage {
    constructor() {
        this.dbName = 'log';
        this.dbVersion = 1;
    }
    load() {
        return Promise.reject('not implemented');
    }
    update(log) {
        return Promise.reject('not implemented');
    }
}
class LocalStorageStorage {
    constructor() {
        this.key = 'log';
    }
    load() {
        const content = localStorage.getItem(this.key);
        if (content) {
            const log = JSON.parse(content);
            if (log) {
                return Promise.resolve(log);
            }
        }
        return Promise.resolve([]);
    }
    update(log) {
        const content = JSON.stringify(log);
        localStorage.setItem(this.key, content);
        return Promise.resolve();
    }
}
class App {
    constructor(storage, global) {
        this.targetEvent = null;
        this.storage = storage;
        this.global = global;
        this.$log = global.document.querySelector("#log");
        this.$logEvent =
            global.document.querySelector("#logEvent");
        this.$logEvent.addEventListener("click", (e) => {
            e.preventDefault();
            const ts = getNow();
            this.onLogEvent(ts);
        });
        this.$status = global.document.querySelector("#status");
        this.$progress = global.document.querySelector("#progress");
        this.$logList = global.document.querySelector("#loglist");
        this.updateProgress = this.updateProgress.bind(this);
        this.updateInterval = setInterval(this.updateProgress, 10000);
    }
    async onLogEvent(ts) {
        const log = await this.storage.load();
        const lastEvent = findLastEvent(log, ts);
        if (lastEvent) {
            const newStart = lastEvent.start == FASTING ? EATING : FASTING;
            log.push(fEvent(ts, newStart));
        }
        else {
            log.push(fEvent(ts, FASTING));
        }
        await this.storage.update(log);
        this.render(log);
    }
    updateProgress() {
        const now = getNow();
        if (this.targetEvent) {
            const msLeft = this.targetEvent.ts - now;
            const hourIndex = this.targetEvent.start === EATING ? FASTING_INDEX : EATING_INDEX;
            const msTotal = fastInterval[hourIndex] * HOUR;
            const x = 100 - Math.floor(msLeft / (msTotal / 100));
            const percent = x > 100 ? 100 : x;
            this.$progress.style.width = `${percent}%`;
            this.$progress.setAttribute('title', `${(msLeft / HOUR).toFixed(2)} hours left`);
        }
    }
    render(log, ts = getNow()) {
        this.$log.value = formatLog(log);
        const targetEvent = getTargetEvent(log, ts);
        this.targetEvent = targetEvent;
        if (targetEvent) {
            this.updateProgress(); // manual update after load
            this.$status.innerText = `Next: ${formatEvent(targetEvent)}`;
        }
        this.$logList.innerHTML = log.map(fEvent => `<li><time>${formatTs(fEvent.ts)}<time> Started ${fEvent.start} <button class="delete" disabled>✖</span></button><button class="edit" disabled>✎</span></button>`).join("\n");
    }
    async run() {
        const log = await this.storage.load();
        this.render(log);
    }
}
new App(new LocalStorageStorage(), window).run();
