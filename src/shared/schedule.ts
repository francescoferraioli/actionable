import { CronExpressionParser } from 'cron-parser';

/**
 * Pure scheduling logic on top of cron expressions (5-field, or 6-field with
 * seconds). All computation is done against explicit dates so it is fully
 * deterministic and testable.
 */

export function isValidExpression(expression: string): boolean {
  try {
    CronExpressionParser.parse(expression);
    return true;
  } catch {
    return false;
  }
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/** The first fire time strictly after `after`, or null for invalid input. */
export function nextFireTime(
  expression: string,
  timezone: string,
  after: Date,
): Date | null {
  try {
    const parsed = CronExpressionParser.parse(expression, {
      currentDate: after,
      tz: timezone,
    });
    return parsed.next().toDate();
  } catch {
    return null;
  }
}

/** The last fire time at or before `at`, or null if none / invalid input. */
export function previousFireTime(
  expression: string,
  timezone: string,
  at: Date,
): Date | null {
  try {
    const parsed = CronExpressionParser.parse(expression, {
      // currentDate is exclusive in both directions; nudge forward so a fire
      // exactly at `at` is included.
      currentDate: new Date(at.getTime() + 1),
      tz: timezone,
    });
    return parsed.prev().toDate();
  } catch {
    return null;
  }
}

/** Fire times in (from, to], capped at `limit` to guard against dense crons. */
export function fireTimesBetween(
  expression: string,
  timezone: string,
  from: Date,
  to: Date,
  limit = 100,
): Date[] {
  const times: Date[] = [];
  let cursor = from;
  while (times.length < limit) {
    const next = nextFireTime(expression, timezone, cursor);
    if (!next || next.getTime() > to.getTime()) {
      break;
    }
    times.push(next);
    cursor = next;
  }
  return times;
}
