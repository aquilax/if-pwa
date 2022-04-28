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
const formatEvent = (e) => `${new Date(e.ts)}\t${e.start}`;
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
class App {
    constructor(storage, global) {
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
    render(log, ts = getNow()) {
        this.$log.value = formatLog(log);
        const targetEvent = getTargetEvent(log, ts);
        if (targetEvent) {
            this.$status.innerText = formatEvent(targetEvent);
        }
    }
    async run() {
        const log = await this.storage.load();
        this.render(log);
    }
}
new App(new MemoryStorage(), window).run();
