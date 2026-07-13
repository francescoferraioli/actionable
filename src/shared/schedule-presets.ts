/**
 * Friendly schedule shapes that compile to cron expressions. The UI works in
 * presets where possible and falls back to raw cron for anything else.
 */

export type SchedulePreset =
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'weekly'; weekday: number; hour: number; minute: number }
  | { kind: 'hourlyBetween'; startHour: number; endHour: number; minute: number }
  | { kind: 'custom'; expression: string };

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export function presetToExpression(preset: SchedulePreset): string {
  switch (preset.kind) {
    case 'daily':
      return `${preset.minute} ${preset.hour} * * *`;
    case 'weekly':
      return `${preset.minute} ${preset.hour} * * ${preset.weekday}`;
    case 'hourlyBetween':
      return `${preset.minute} ${preset.startHour}-${preset.endHour} * * *`;
    case 'custom':
      return preset.expression;
  }
}

const DAILY_PATTERN = /^(\d{1,2}) (\d{1,2}) \* \* \*$/;
const WEEKLY_PATTERN = /^(\d{1,2}) (\d{1,2}) \* \* ([0-6])$/;
const HOURLY_BETWEEN_PATTERN = /^(\d{1,2}) (\d{1,2})-(\d{1,2}) \* \* \*$/;

export function expressionToPreset(expression: string): SchedulePreset {
  const normalized = expression.trim().replace(/\s+/g, ' ');

  const daily = normalized.match(DAILY_PATTERN);
  if (daily) {
    return { kind: 'daily', minute: Number(daily[1]), hour: Number(daily[2]) };
  }

  const weekly = normalized.match(WEEKLY_PATTERN);
  if (weekly) {
    return {
      kind: 'weekly',
      minute: Number(weekly[1]),
      hour: Number(weekly[2]),
      weekday: Number(weekly[3]),
    };
  }

  const hourly = normalized.match(HOURLY_BETWEEN_PATTERN);
  if (hourly) {
    return {
      kind: 'hourlyBetween',
      minute: Number(hourly[1]),
      startHour: Number(hourly[2]),
      endHour: Number(hourly[3]),
    };
  }

  return { kind: 'custom', expression: normalized };
}

export function formatTime(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
}

function formatHour(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}${period.toLowerCase()}`;
}

export function describeExpression(expression: string): string {
  const preset = expressionToPreset(expression);
  switch (preset.kind) {
    case 'daily':
      return `Daily at ${formatTime(preset.hour, preset.minute)}`;
    case 'weekly':
      return `Weekly on ${WEEKDAY_NAMES[preset.weekday]} at ${formatTime(preset.hour, preset.minute)}`;
    case 'hourlyBetween': {
      const minutePart = preset.minute === 0 ? '' : ` at :${String(preset.minute).padStart(2, '0')}`;
      return `Every hour from ${formatHour(preset.startHour)} to ${formatHour(preset.endHour)}${minutePart}`;
    }
    case 'custom':
      return `Cron: ${preset.expression}`;
  }
}
