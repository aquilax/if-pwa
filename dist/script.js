(() => {
  // src/utils.ts
  var EATING = "eating";
  var FASTING = "fasting";
  var S_STATE_SUCCESS = "success";
  var S_STATE_FAILURE = "failure";
  var FASTING_INDEX = 0;
  var EATING_INDEX = 1;
  var ENTRIES_TO_SHOW = 10;
  var HOUR = 3600 * 1e3;
  var fastInterval = [16, 8];
  var getTs = (d) => d.getTime();
  var getNow = () => getTs(new Date());
  var fEvent = (ts, start) => ({ ts, start });
  var twoDigitPad = (num) => num < 10 ? "0" + num : num;
  var dayOfWeekNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday"
  ];
  var formatDate = (date, patternStr = "yyyy-MM-dd HH:mm:ss") => {
    const day = date.getDate(), month = date.getMonth(), year = date.getFullYear(), hour = date.getHours(), minute = date.getMinutes(), second = date.getSeconds(), milliseconds = date.getMilliseconds(), h = hour % 12, hh = twoDigitPad(h), HH = twoDigitPad(hour), mm = twoDigitPad(minute), ss = twoDigitPad(second), EEEE = dayOfWeekNames[date.getDay()], EEE = EEEE.substring(0, 3), dd = twoDigitPad(day), M = month + 1, MM = twoDigitPad(M), yyyy = year.toString(), yy = yyyy.substring(2, 4);
    return patternStr.replace("hh", hh.toString()).replace("h", h.toString()).replace("HH", HH.toString()).replace("H", hour.toString()).replace("mm", mm.toString()).replace("m", minute.toString()).replace("ss", ss.toString()).replace("s", second.toString()).replace("S", milliseconds.toString()).replace("dd", dd.toString()).replace("d", day.toString()).replace("yyyy", yyyy).replace("yy", yy).replace("MM", MM.toString()).replace("M", M.toString()).replace("EEEE", EEEE).replace("EEE", EEE);
  };
  var formatTs = (ts) => {
    const date = new Date(ts);
    return formatDate(date, "yyyy-MM-dd HH:mm:ss");
  };
  var getLocaleDateTime = (ts) => {
    const d = new Date(ts);
    return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, -8);
  };
  var findLastEvent = (log, now) => {
    let lastEvent = null;
    let lastTs = null;
    const paddedLog = [{ ts: -1, start: EATING }, ...log];
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
  var getTargetEvent = (log, now) => {
    const lastEvent = findLastEvent(log, now);
    if (lastEvent) {
      if (lastEvent.start === FASTING) {
        return fEvent(lastEvent.ts + fastInterval[FASTING_INDEX] * HOUR, EATING);
      }
      return fEvent(lastEvent.ts + fastInterval[EATING_INDEX] * HOUR, FASTING);
    }
    return null;
  };
  var getLogEntry = (template, event) => {
    var clone = template.content.cloneNode(true);
    const entry = clone.querySelector(".entry");
    entry.dataset.ts = event.ts.toString(10);
    entry.classList.add(event.start);
    if (event.successState) {
      entry.classList.add(event.successState);
    }
    const time = clone.querySelector("time");
    time.innerHTML = formatDate(new Date(event.ts), "EEE dd<br/>HH:mm");
    time.setAttribute("datetime", new Date(event.ts).toISOString());
    clone.querySelector(".message").innerText = `[${formatDateDiff(event.duration, true)}] Started ${event.start}`;
    clone.querySelector(".timeEdit").value = getLocaleDateTime(event.ts);
    return clone;
  };
  var formatEvent = (e) => `${formatTs(e.ts)}	${e.start}`;
  var formatLog = (log) => log.map(formatEvent).join("\n");
  var formatDateDiff = (ts, omitSeconds = false) => {
    const msInHour = 60 * 60 * 1e3;
    const msInMin = 60 * 1e3;
    const msInSec = 1e3;
    let rem = ts;
    const h = Math.floor(rem / msInHour);
    rem = rem - h * msInHour;
    const m = Math.floor(rem / msInMin);
    rem = rem - m * msInMin;
    const s = Math.floor(rem / msInSec);
    return omitSeconds ? `${twoDigitPad(h)}:${twoDigitPad(m)}` : `${twoDigitPad(h)}:${twoDigitPad(m)}:${twoDigitPad(s)}`;
  };
  var getDuration = (e1, e2) => e1.ts - e2.ts;
  var getSuccessState = (e1, e2) => {
    const diff = getDuration(e1, e2);
    if (e1.start === EATING) {
      const interval2 = fastInterval[FASTING_INDEX] * HOUR;
      return diff >= interval2 ? S_STATE_SUCCESS : S_STATE_FAILURE;
    }
    const interval = fastInterval[EATING_INDEX] * HOUR;
    return diff <= interval ? S_STATE_SUCCESS : S_STATE_FAILURE;
  };
  var fEventsToDecoratedEvents = (log) => log.map((e, index) => index === 0 ? { ...e, successState: null, duration: 0 } : { ...e, successState: getSuccessState(e, log[index - 1]), duration: getDuration(e, log[index - 1]) });

  // src/App.ts
  var App = class {
    constructor(storage, backupManager, global) {
      this.targetEvent = null;
      this.storage = storage;
      this.backupManager = backupManager;
      this.global = global;
      this.$log = global.document.querySelector("#log");
      this.$logEvent = global.document.querySelector("#logEvent");
      this.$progress = global.document.querySelector("#progress");
      this.$remaining = global.document.querySelector("#remaining");
      this.$remainingLabel = global.document.querySelector("#remainingLabel");
      this.$last = global.document.querySelector("#last");
      this.$goal = global.document.querySelector("#goal");
      this.$logList = global.document.querySelector("#logList");
      this.$entryTemplate = global.document.querySelector("#logEntry");
      this.$importFile = global.document.querySelector("#importFile");
      this.updateProgress = this.updateProgress.bind(this);
      this.updateInterval = setInterval(this.updateProgress, 1e3);
      global.document.addEventListener("click", (e) => {
        const target = e.target;
        if (target) {
          if (target.matches("#logEvent")) {
            e.preventDefault();
            const ts = getNow();
            return this.onLogEvent(ts);
          }
          if (target.matches(".edit") || target.matches(".editCancel")) {
            e.preventDefault();
            const parent = target.closest(".entry");
            if (parent) {
              parent.querySelector(".editEvent").classList.toggle("hidden");
            }
          }
          if (target.matches(".delete") || target.matches(".deleteCancel")) {
            e.preventDefault();
            const parent = target.closest(".entry");
            if (parent) {
              parent.querySelector(".deleteEvent").classList.toggle("hidden");
            }
          }
          if (target.matches(".editConfirm")) {
            e.preventDefault();
            const parent = target.closest(".entry");
            if (parent && parent.dataset.ts) {
              const ts = parseInt(parent.dataset.ts, 10);
              const timeEdit = target.parentElement?.querySelector(".timeEdit");
              if (timeEdit) {
                const newTime = timeEdit.value;
                const newTs = getTs(new Date(`${newTime}:00`));
                this.updateLog(ts, newTs).then(() => parent.querySelector(".editEvent").classList.toggle("hidden"));
              }
            }
          }
          if (target.matches(".deleteConfirm")) {
            e.preventDefault();
            const parent = target.closest(".entry");
            if (parent && parent.dataset.ts) {
              const ts = parseInt(parent.dataset.ts, 10);
              this.deleteLogEntry(ts);
            }
          }
          if (target.matches("#backup")) {
            this.storage.load().then((log) => {
              const text = this.backupManager.backup(log);
              const shareData = { text, title: "IF Export" };
              if (typeof navigator.share === "function" && navigator.canShare && navigator.canShare(shareData)) {
                navigator.share(shareData).catch(console.error);
              } else {
                this.$log.value = text;
              }
            });
          }
          if (target.matches("#backupFile")) {
            this.storage.load().then((log) => {
              const text = this.backupManager.backup(log);
              const exportName = "if-log.json";
              var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(text);
              var downloadAnchorNode = document.createElement("a");
              downloadAnchorNode.setAttribute("href", dataStr);
              downloadAnchorNode.setAttribute("download", exportName);
              document.body.appendChild(downloadAnchorNode);
              downloadAnchorNode.click();
              downloadAnchorNode.remove();
            });
          }
          if (target.matches("#backupShareFile")) {
            this.storage.load().then((log) => {
              const text = this.backupManager.backup(log);
              const shareData = { title: "IF Export", files: [new File([text], "test.txt", { type: "text/plain" })] };
              if (typeof navigator.share === "function" && navigator.canShare && navigator.canShare(shareData)) {
                navigator.share(shareData).catch(console.error);
              }
            });
          }
          if (target.matches("#restore")) {
            if (this.global.confirm("Are you sure you want to restore data from the textbox?")) {
              const text = this.$log.value;
              const log = this.backupManager.restore(text);
              const sortedLog = [...log].sort((a, b) => a.ts - b.ts);
              this.storage.update(sortedLog).then(() => {
                this.render(sortedLog, getNow());
              });
            }
          }
          if (target.matches("#restoreFile")) {
            this.$importFile.click();
          }
        }
      });
      this.$importFile.addEventListener("input", () => {
        const input = this.$importFile;
        if (input.files) {
          if (input.files[0]) {
            const file = input.files[0];
            const fr = new FileReader();
            fr.onload = (e) => {
              if (e.target) {
                const text = e.target.result;
                if (text) {
                  const log = this.backupManager.restore(text);
                  const sortedLog = [...log].sort((a, b) => a.ts - b.ts);
                  this.storage.update(sortedLog).then(() => {
                    this.render(sortedLog, getNow());
                  });
                }
              }
            };
            fr.readAsText(file);
          }
        }
      });
    }
    async onLogEvent(ts) {
      const log = await this.storage.load();
      const lastEvent = findLastEvent(log, ts);
      const targetEvent = getTargetEvent(log, ts);
      if (targetEvent) {
        if (targetEvent.ts > ts && targetEvent.start === EATING) {
          if (!this.global.confirm("There is still time left. Are you sure?")) {
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
    async updateLog(ts, newTs) {
      const log = await this.storage.load();
      const newLog = log.map((event) => event.ts === ts ? { ...event, ts: newTs } : event);
      const sortedLog = [...newLog].sort((a, b) => a.ts - b.ts);
      await this.storage.update(sortedLog);
      this.render(sortedLog, getNow());
    }
    async deleteLogEntry(ts) {
      const log = await this.storage.load();
      const newLog = log.flatMap((event) => event.ts === ts ? [] : [event]);
      const sortedLog = [...newLog].sort((a, b) => a.ts - b.ts);
      await this.storage.update(sortedLog);
      this.render(sortedLog, getNow());
    }
    updateProgress() {
      const now = getNow();
      if (this.targetEvent) {
        const msLeft = this.targetEvent.ts - now;
        const hourIndex = this.targetEvent.start === EATING ? FASTING_INDEX : EATING_INDEX;
        const msTotal = fastInterval[hourIndex] * HOUR;
        const x = 100 - Math.floor(msLeft / (msTotal / 100));
        const percent = x > 100 ? 100 : x;
        const msToShow = msLeft < 0 ? now - this.targetEvent.ts : msLeft;
        this.$remainingLabel.innerText = msLeft < 0 ? "Extra" : "Remaining";
        this.$remaining.innerText = `${formatDateDiff(msToShow)} [${100 - percent}%]`;
        this.$last.innerText = formatDate(new Date(this.targetEvent.ts - msTotal), "EEE dd HH:mm");
        this.$goal.innerText = formatDate(new Date(this.targetEvent.ts), "EEE dd HH:mm");
        this.$progress.style.width = `${percent}%`;
        if (msLeft <= 0) {
          this.$progress.classList.add("green");
        } else {
          this.$progress.classList.remove("green");
        }
        this.$progress.setAttribute("title", `${(msLeft / HOUR).toFixed(2)} hours left`);
      }
    }
    render(log, ts) {
      this.$log.value = formatLog(log);
      const targetEvent = getTargetEvent(log, ts);
      this.targetEvent = targetEvent;
      if (targetEvent) {
        this.$logEvent.innerText = targetEvent.start === EATING ? "Start eating" : "Start fasting";
        this.updateProgress();
      }
      if (log) {
        this.$logList.replaceChildren();
        fEventsToDecoratedEvents(log).slice(-ENTRIES_TO_SHOW).reverse().forEach((event) => {
          this.$logList.appendChild(getLogEntry(this.$entryTemplate, event));
        });
      }
    }
    async run() {
      const log = await this.storage.load();
      this.render(log, getNow());
    }
  };

  // src/backup/BackupManagerV1.ts
  var BackupManagerV1 = class {
    constructor() {
      this.version = 1;
    }
    backup(log) {
      return JSON.stringify({
        version: this.version,
        events: log.map((e) => ({ ...e, ts: new Date(e.ts).toISOString() }))
      }, null, 2);
    }
    restore(text) {
      const { version, events } = JSON.parse(text);
      if (version !== this.version) {
        throw new Error("incorrect backup version");
      }
      return events.map((e) => ({ ...e, ts: getTs(new Date(e.ts)) }));
    }
  };

  // src/storage/LocalStorage.ts
  var LocalStorage = class {
    constructor() {
      this.key = "log";
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
    isAvailable() {
      return true;
    }
  };

  // src/index.ts
  window.addEventListener("load", () => {
    new App(new LocalStorage(), new BackupManagerV1(), window).run();
  });
})();
