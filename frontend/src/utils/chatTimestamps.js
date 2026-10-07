/**
 * Time dividers for the chat transcript.
 *
 * The transcript is broken up by a centered label whenever the conversation
 * pauses, in the reader's own timezone. The pause rule is the same one the
 * prompt's time marker uses on the backend (`MIN_GAP_SECONDS` in
 * `backend/utils/prompt_time.py`), so the breaks the user sees are the gaps the
 * character is told about — the same clock, one source.
 *
 * Messages whose `created_at` the backend could not vouch for arrive without the
 * field, and a message with no time never produces a label.
 */

// Mirror of `MIN_GAP_SECONDS` in `backend/utils/prompt_time.py`. The server sends
// the authoritative value as `timestamp_gap_seconds` on every chat entry; this is
// only the fallback for a message list that has not been persisted yet.
export const DEFAULT_TIMESTAMP_GAP_SECONDS = 30 * 60;

const DAY_MS = 24 * 60 * 60 * 1000;

// `h23` keeps midnight at 00:xx instead of some locales' 24:xx.
const CLOCK_FORMATTER = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

const DAY_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const EXACT_FORMATTER = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const parseTimestamp = (value) => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : new Date(time);
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const isSameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();

const formatClock = (date) => CLOCK_FORMATTER.format(date);

/**
 * "22:41" while the day is current, "昨天 22:41" for the day before, and a dated
 * "10月5日 22:41" (with a year once it is no longer this year) for anything older.
 *
 * @param {Date|null} previous - timestamp of the preceding timestamped message
 * @param {Date}       date     - timestamp the divider sits above
 * @param {Date}       now      - "today", injectable for tests
 * @returns {string|null} the label, or null when the timestamp is unusable
 */
export function formatTranscriptDivider(previous, date, now = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

  const time = formatClock(date);

  // A day the reader already knows — today, or the day the break above started —
  // needs no date: the clock alone is unambiguous.
  if (isSameDay(date, now)) return time;
  if (previous && isSameDay(date, previous)) return time;

  const daysAgo = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS);
  if (daysAgo === 1) return `昨天 ${time}`;
  const dayLabel = date.getFullYear() === now.getFullYear()
    ? DAY_MONTH_FORMATTER.format(date)
    : DAY_MONTH_YEAR_FORMATTER.format(date);
  return `${dayLabel} ${time}`;
}

/**
 * Exact local time of a single message, for the tap/hover reveal on a bubble.
 * Null when the message has no trustworthy time.
 */
export function formatExactMessageTimestamp(value) {
  const date = parseTimestamp(value);
  return date ? EXACT_FORMATTER.format(date) : null;
}

/**
 * Short local clock of a single message ("22:41"), or null.
 */
export function formatMessageClock(value) {
  const date = parseTimestamp(value);
  return date ? formatClock(date) : null;
}

/**
 * Indexes of a rendered transcript that should be preceded by a time divider,
 * mapped to the label to draw.
 *
 * A divider is drawn when the message follows a pause of more than `gapSeconds`
 * or when it starts a new day. Messages without a trustworthy time never produce
 * a divider, and they do not stand in for the previous one either.
 *
 * @param {Array<{created_at?: string}>} messages - messages in render order
 * @param {number} gapSeconds
 * @param {Date}   now
 * @returns {Map<number, string>}
 */
export function buildTranscriptDividers(messages, gapSeconds = DEFAULT_TIMESTAMP_GAP_SECONDS, now = new Date()) {
  const dividers = new Map();
  const threshold = Number.isFinite(gapSeconds) && gapSeconds > 0
    ? gapSeconds
    : DEFAULT_TIMESTAMP_GAP_SECONDS;
  let previous = null;

  (messages || []).forEach((message, index) => {
    const date = parseTimestamp(message?.created_at);
    if (!date) return;

    const pauseSeconds = previous ? (date.getTime() - previous.getTime()) / 1000 : Infinity;
    // A backwards clock (or a future-stamped row) is not a pause to label, but a
    // genuinely different day still breaks the transcript.
    const shouldDivide = pauseSeconds > threshold || !isSameDay(date, previous || date);

    if (shouldDivide) {
      const label = formatTranscriptDivider(previous, date, now);
      if (label) dividers.set(index, label);
    }
    previous = date;
  });

  return dividers;
}
