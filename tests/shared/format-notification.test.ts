import { describe, expect, it } from 'vitest';
import { formatNotificationBody } from '../../src/shared/format';

describe('formatNotificationBody', () => {
  it('uses fallback for empty input', () => {
    expect(formatNotificationBody(null, 'fallback')).toBe('fallback');
    expect(formatNotificationBody('', 'fallback')).toBe('fallback');
    expect(formatNotificationBody('   ', 'fallback')).toBe('fallback');
  });

  it('collapses whitespace', () => {
    expect(formatNotificationBody('line one\n\nline two', 'fallback')).toBe('line one line two');
  });

  it('truncates long bodies to fit macOS byte limits', () => {
    const long = 'a'.repeat(300);
    const result = formatNotificationBody(long, 'fallback');
    expect(new TextEncoder().encode(result).length).toBeLessThanOrEqual(240);
    expect(result.endsWith('…')).toBe(true);
  });
});
