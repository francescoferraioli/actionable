const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

function describeDelta(deltaMs: number): string {
  if (deltaMs >= DAY_MS) {
    return plural(Math.floor(deltaMs / DAY_MS), 'day');
  }
  if (deltaMs >= HOUR_MS) {
    return plural(Math.floor(deltaMs / HOUR_MS), 'hour');
  }
  return plural(Math.max(1, Math.floor(deltaMs / MINUTE_MS)), 'minute');
}

/** "Due just now", "Due 10 minutes ago", or "Due in 2 hours". */
export function formatDue(scheduledAt: string, now: Date): string {
  const deltaMs = now.getTime() - new Date(scheduledAt).getTime();
  if (Math.abs(deltaMs) < MINUTE_MS) {
    return 'Due just now';
  }
  if (deltaMs > 0) {
    return `Due ${describeDelta(deltaMs)} ago`;
  }
  return `Due in ${describeDelta(-deltaMs)}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function startOfDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

/** "Today", "Yesterday", or e.g. "Mon 13 Jul". */
export function formatDayHeading(iso: string, now: Date): string {
  const dayStart = startOfDay(new Date(iso));
  const todayStart = startOfDay(now);
  if (dayStart === todayStart) {
    return 'Today';
  }
  if (todayStart - dayStart === DAY_MS) {
    return 'Yesterday';
  }
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function formatHourOfDay(hour: number): string {
  const period = hour < 12 ? 'am' : 'pm';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period}`;
}

export function formatPercent(rate: number | null): string {
  if (rate === null) {
    return '–';
  }
  return `${Math.round(rate * 100)}%`;
}
