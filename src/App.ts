import { BackupManager } from "backup/types";
import { LogStorage } from "storage/types";
import { EATING, EATING_INDEX, ENTRIES_TO_SHOW, FASTING, FASTING_INDEX, fastInterval, fEvent, FEvent, FEventLog, fEventsToDecoratedEvents, findLastEvent, formatDate, formatDateDiff, formatLog, getLogEntry, getNow, getTargetEvent, getTs, HOUR, Timestamp } from "utils";

export class App {
  targetEvent: FEvent | null = null;
  storage: LogStorage;
  backupManager: BackupManager;
  global: Window;
  updateInterval: number
  $log: HTMLTextAreaElement;
  $logEvent: HTMLButtonElement
  $progress: HTMLDivElement;
  $remaining: HTMLDivElement;
  $remainingLabel: HTMLDivElement;
  $last: HTMLDivElement;
  $goal: HTMLDivElement;
  $logList: HTMLOListElement
  $entryTemplate: HTMLTemplateElement;
  $importFile: HTMLInputElement;

  constructor(storage: LogStorage, backupManager: BackupManager, global: Window) {
    this.storage = storage;
    this.backupManager = backupManager;
    this.global = global;
    this.$log = global.document.querySelector<HTMLTextAreaElement>('#log')!;
    this.$logEvent = global.document.querySelector<HTMLButtonElement>('#logEvent')!;
    this.$progress = global.document.querySelector<HTMLDivElement>('#progress')!;
    this.$remaining = global.document.querySelector<HTMLDivElement>('#remaining')!;
    this.$remainingLabel = global.document.querySelector<HTMLDivElement>('#remainingLabel')!;
    this.$last = global.document.querySelector<HTMLDivElement>('#last')!;
    this.$goal = global.document.querySelector<HTMLDivElement>('#goal')!;
    this.$logList = global.document.querySelector<HTMLOListElement>('#logList')!;
    this.$entryTemplate = global.document.querySelector<HTMLTemplateElement>('#logEntry')!;
    this.$importFile = global.document.querySelector('#importFile') as HTMLInputElement;
    this.updateProgress = this.updateProgress.bind(this);

    // start update timer
    this.updateInterval = setInterval(this.updateProgress, 1000) as any as number;

    // Global click handler
    global.document.addEventListener('click', (e: MouseEvent) => {
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
        // Backup share file
        if (target.matches('#backupShareFile')) {
          this.storage.load().then((log) => {
            const text = this.backupManager.backup(log);
            const shareData = {title: 'IF Export', files: [new File([text],"test.txt", {type: "text/plain"})]};
            if (typeof navigator.share === 'function' && navigator.canShare && navigator.canShare(shareData)) {
              navigator.share(shareData).catch(console.error)
            }
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
            });
          }
        }
        // Restore from file
        if (target.matches('#restoreFile')) {
          this.$importFile.click();
        }
      }
    })
    // Restore from file
    this.$importFile.addEventListener('input', (): any => {
      const input = this.$importFile;
      if (input.files) {
        if (input.files[0]) {
          const file = input.files[0];
          const fr = new FileReader();
          fr.onload = (e: ProgressEvent<FileReader>) => {
            if (e.target) {
              const text = e.target.result as string;
              if (text) {
                const log = this.backupManager.restore(text);
                const sortedLog = [...log].sort((a, b) => a.ts - b.ts)
                this.storage.update(sortedLog).then(() => {
                  this.render(sortedLog, getNow());
                });
              }
            }
          };
          fr.readAsText(file);
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

      // Decide which time to show extra or remaining
      const msToShow = msLeft < 0 ? now - this.targetEvent.ts : msLeft;

      this.$remainingLabel.innerText = msLeft < 0 ? 'Extra' : 'Remaining';
      this.$remaining.innerText = `${formatDateDiff(msToShow)} [${100-percent}%]`;
      this.$last.innerText = formatDate(new Date(this.targetEvent.ts - msTotal), "EEE dd HH:mm")
      this.$goal.innerText = formatDate(new Date(this.targetEvent.ts), "EEE dd HH:mm")

      this.$progress.style.width = `${percent}%`;
      if (msLeft <= 0) {
        this.$progress.classList.add('green');
      } else {
        this.$progress.classList.remove('green');
      }
      this.$progress.setAttribute('title', `${(msLeft / HOUR).toFixed(2)} hours left`)
    }
  }

  render(log:FEventLog, ts: Timestamp): void {
    this.$log.value = formatLog(log);
    const targetEvent = getTargetEvent(log, ts);
    this.targetEvent = targetEvent;
    if (targetEvent) {
      this.$logEvent.innerText = targetEvent.start === EATING ? 'Start eating' : 'Start fasting';
      this.updateProgress(); // manual update after load
    }
    if (log) {
      // clean all children
      this.$logList.replaceChildren();
      // render last ENTRIES_TO_SHOW
      fEventsToDecoratedEvents(log).slice(-ENTRIES_TO_SHOW).reverse().forEach(event => {
        this.$logList.appendChild(getLogEntry(this.$entryTemplate, event));
      });
    }
  }

  async run() {
    const log = await this.storage.load();
    this.render(log, getNow());
  }
}
