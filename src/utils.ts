export type Timestamp = number;
export type State = 'fasting' | 'eating';
export type FEvent = {
  ts: Timestamp;
  start: State;
};
export type FEventLog = Array<FEvent>;

export const EATING: State = 'eating';
export const FASTING: State = 'fasting';
export const FASTING_INDEX = 0;
export const EATING_INDEX = 1;
export const ENTRIES_TO_SHOW = 10;
export const HOUR = 3600 * 1000;

export const fastInterval = [16, 8]; // fast, eat

export const getTs = (d: Date): Timestamp => d.getTime();
export const getNow = (): Timestamp => getTs(new Date());
export const fEvent = (ts: Timestamp, start: State): FEvent => ({ ts, start });
export const twoDigitPad = (num: number) => num < 10 ? '0' + num : num;

const dayOfWeekNames = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

// https://stackoverflow.com/a/52789490/17734
export const formatDate = (date: Date, patternStr = 'yyyy-MM-dd HH:mm:ss'): string => {
  const day = date.getDate(),
      month = date.getMonth(),
      year = date.getFullYear(),
      hour = date.getHours(),
      minute = date.getMinutes(),
      second = date.getSeconds(),
      milliseconds = date.getMilliseconds(),
      h = hour % 12,
      hh = twoDigitPad(h),
      HH = twoDigitPad(hour),
      mm = twoDigitPad(minute),
      ss = twoDigitPad(second),
      EEEE = dayOfWeekNames[date.getDay()],
      EEE = EEEE.substring(0, 3),
      dd = twoDigitPad(day),
      M = month + 1,
      MM = twoDigitPad(M),
      yyyy = year.toString(),
      yy = yyyy.substring(2, 4)
  ;
  return patternStr
    .replace('hh', hh.toString()).replace('h', h.toString())
    .replace('HH', HH.toString()).replace('H', hour.toString())
    .replace('mm', mm.toString()).replace('m', minute.toString())
    .replace('ss', ss.toString()).replace('s', second.toString())
    .replace('S', milliseconds.toString())
    .replace('dd', dd.toString()).replace('d', day.toString())
    .replace('yyyy', yyyy)
    .replace('yy', yy)
    .replace('MM', MM.toString()).replace('M', M.toString())
    .replace('EEEE', EEEE).replace('EEE', EEE);
}

export const formatTs = (ts: Timestamp): string => {
  const date = new Date(ts);
  return formatDate(date, 'yyyy-MM-dd HH:mm:ss');
}

export const getLocaleDateTime = (ts: Timestamp): string => {
  const d = new Date(ts);
  return (new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString()).slice(0, -8); // remove timezone, ms and s
}

/**
 * Returns the last event before the now timestamp or null
 * Expects log to be sorted in chronological order
 */
export const findLastEvent = (log: FEventLog, now: Timestamp): FEvent | null => {
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
 export const getState = (log: FEventLog, now: Timestamp): State => {
  const lastEvent = findLastEvent(log, now);
  if (lastEvent) {
    return lastEvent.start;
  }
  return EATING;
};

/**
 * Returns the next FEvent given timestamp `now` and ordered `log`
 */
 export const getTargetEvent = (log: FEventLog, now: Timestamp): FEvent | null => {
  const lastEvent = findLastEvent(log, now);
  if (lastEvent) {
    if (lastEvent.start === FASTING) {
      return fEvent(lastEvent.ts + fastInterval[FASTING_INDEX]*HOUR, EATING);
    }
    return fEvent(lastEvent.ts + fastInterval[EATING_INDEX]*HOUR, FASTING);
  }
  return null;
};


export const getLogEntry = (template: HTMLTemplateElement, event: FEvent): Element => {
  var clone = template.content.cloneNode(true) as HTMLElement;

  const entry = (clone.querySelector('.entry') as HTMLElement)
  entry.dataset.ts = event.ts.toString(10);
  entry.classList.add(event.start);

  const time = (clone.querySelector('time') as HTMLElement)
  time.innerHTML = formatDate(new Date(event.ts), 'EEE dd<br/>HH:mm');
  time.setAttribute('datetime', new Date(event.ts).toISOString());

  (clone.querySelector('.message') as HTMLElement).innerText = `Started ${event.start}`;
  (clone.querySelector('.timeEdit') as HTMLInputElement).value = getLocaleDateTime(event.ts);
  return clone
}

export const formatEvent = (e: FEvent): string => `${formatTs(e.ts)}\t${e.start}`;
export const formatLog = (log: FEventLog): string =>log.map(formatEvent).join('\n');
export const formatDateDiff = (ts: Timestamp): string => {
  const msInHour = 60*60*1000;
  const msInMin = 60*1000;
  const msInSec = 1000;
  let rem = ts;
  const h = Math.floor(rem / msInHour);
  rem = rem - (h * msInHour);
  const m = Math.floor(rem / msInMin);
  rem = rem - (m * msInMin);
  const s = Math.floor(rem / msInSec);
  return `${twoDigitPad(h)}:${twoDigitPad(m)}:${twoDigitPad(s)}`;
}