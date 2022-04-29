"use strict";
const EATING = "eating";
const FASTING = "fasting";
const FASTING_INDEX = 0;
const EATING_INDEX = 1;
const ENTRIES_TO_SHOW = 10;
const HOUR = 3600 * 1000;
const fastInterval = [16, 8]; // fast, eat
const getTs = (d) => d.getTime();
const getNow = () => getTs(new Date());
const fEvent = (ts, start) => ({ ts, start });
const twoDigitPad = (num) => num < 10 ? "0" + num : num;
const getTime = (ts) => {
    const date = new Date(ts);
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();
    return `${twoDigitPad(hour)}:${twoDigitPad(minute)}:${twoDigitPad(second)}`;
};
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
const getLocaleDateTime = (ts) => {
    const d = new Date(ts);
    return (new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()).slice(0, -8); // remove timezone, ms and s
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
const getLogEntry = (template, fEvent) => {
    var clone = template.content.cloneNode(true);
    clone.querySelector('.entry').dataset.ts = fEvent.ts.toString(10);
    clone.querySelector('time').innerText = formatTs(fEvent.ts);
    clone.querySelector('.message').innerText = `Started ${fEvent.start}`;
    clone.querySelector('.timeEdit').value = getLocaleDateTime(fEvent.ts);
    return clone;
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
    update(_log) {
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
        this.$status = global.document.querySelector("#status");
        this.$progress = global.document.querySelector("#progress");
        this.$logList = global.document.querySelector("#logList");
        this.$entryTemplate = global.document.querySelector("#logEntry");
        this.updateProgress = this.updateProgress.bind(this);
        // start update timer
        this.updateInterval = setInterval(this.updateProgress, 1000);
        // Global click handler
        global.document.addEventListener("click", (e) => {
            const target = e.target;
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
                    const parent = target.closest('.entry');
                    if (parent) {
                        parent.querySelector('.editEvent').classList.toggle('hidden');
                    }
                }
                // Save edit
                if (target.matches('.editConfirm')) {
                    e.preventDefault();
                    const parent = target.closest('.entry');
                    if (parent && parent.dataset.ts) {
                        const ts = parseInt(parent.dataset.ts, 10);
                        const timeEdit = target.parentElement?.querySelector('.timeEdit');
                        if (timeEdit) {
                            const newTime = timeEdit.value;
                            const newTs = getTs(new Date(`${newTime}:00`));
                            this.updateLog(ts, newTs)
                                .then(() => parent.querySelector('.editEvent').classList.toggle('hidden'));
                        }
                    }
                }
                // Backup
                if (target.matches('#backup')) {
                    this.storage.load().then((log) => {
                        const text = JSON.stringify(log, null, 2);
                        const shareData = { text, title: 'IF Export' };
                        if (typeof navigator.share === 'function' && navigator.canShare && navigator.canShare(shareData)) {
                            navigator.share(shareData).catch(console.error);
                        }
                        else {
                            this.$log.value = text;
                        }
                    });
                }
            }
        });
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
        this.render(log, getNow());
    }
    async updateLog(ts, newTs) {
        const log = await this.storage.load();
        const newLog = log
            .map((event) => event.ts === ts ? { ...event, ts: newTs } : event)
            .sort((a, b) => a.ts - b.ts);
        await this.storage.update(newLog);
        this.render(newLog, getNow());
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
    render(log, ts) {
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
            log.slice(-ENTRIES_TO_SHOW).reverse().forEach(fEvent => {
                this.$logList.appendChild(getLogEntry(this.$entryTemplate, fEvent));
            });
        }
    }
    async run() {
        const log = await this.storage.load();
        this.render(log, getNow());
    }
}
window.addEventListener('load', () => {
    new App(new LocalStorageStorage(), window).run();
});
//# sourceMappingURL=script.js.map