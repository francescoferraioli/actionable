import { useState } from 'react';
import { formatHourOfDay, formatPercent } from '../../../shared/format';
import type { AnalyticsSummary, DailyTrendPoint, TodoAnalytics } from '../../../shared/types';
import { api } from '../lib/api';
import { useAsyncData, useDataVersion } from '../lib/hooks';

const RANGE_OPTIONS = [7, 30, 90] as const;

const SERIES = {
  completed: { label: 'Completed', color: '#1e8e4e' },
  dismissed: { label: 'Dismissed', color: '#c93a3a' },
} as const;

function StatTile({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="stat-tile">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function Meter({ rate, color, track }: { rate: number; color: string; track: string }):
  React.JSX.Element {
  return (
    <div className="rate-bar" style={{ background: track }}>
      <div
        className="rate-bar-fill"
        style={{ width: `${Math.round(rate * 100)}%`, background: color }}
      />
    </div>
  );
}

/** Rectangle with a rounded top (data end) and a square baseline. */
function roundedTopRect(x: number, y: number, width: number, height: number): string {
  const radius = Math.min(4, width / 2, height);
  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + width - radius} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + radius}`,
    `L ${x + width} ${y + height}`,
    'Z',
  ].join(' ');
}

function niceCeiling(value: number): number {
  if (value <= 4) {
    return 4;
  }
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const candidates = [1, 2, 4, 5, 10].map((factor) => factor * magnitude);
  return candidates.find((candidate) => candidate >= value) ?? 10 * magnitude;
}

const trendDateLabel = (dateKey: string): string =>
  new Date(`${dateKey}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });

interface TrendChartProps {
  points: DailyTrendPoint[];
}

function TrendChart({ points }: TrendChartProps): React.JSX.Element {
  const [hovered, setHovered] = useState<number | null>(null);

  const width = 700;
  const height = 200;
  const margin = { top: 8, right: 8, bottom: 24, left: 32 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  const yMax = niceCeiling(
    Math.max(1, ...points.map((point) => point.completed + point.dismissed)),
  );
  const slotWidth = plotWidth / points.length;
  const barWidth = Math.min(24, Math.max(3, slotWidth - 4));
  const yFor = (value: number): number => margin.top + plotHeight * (1 - value / yMax);
  const heightFor = (value: number): number => (plotHeight * value) / yMax;

  const ticks = [0, yMax / 2, yMax];
  const labelEvery = Math.max(1, Math.ceil(points.length / 6));

  return (
    <div className="card" style={{ position: 'relative' }}>
      <div className="chart-legend">
        {Object.values(SERIES).map((series) => (
          <span key={series.label} className="legend-item">
            <span className="legend-swatch" style={{ background: series.color }} />
            {series.label}
          </span>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', display: 'block' }}
        role="img"
        aria-label="Daily completed and dismissed occurrences"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={yFor(tick)}
              y2={yFor(tick)}
              stroke="#e9ecef"
              strokeWidth="1"
            />
            <text x={margin.left - 6} y={yFor(tick) + 4} textAnchor="end" className="chart-tick">
              {tick}
            </text>
          </g>
        ))}
        {points.map((point, index) => {
          const x = margin.left + index * slotWidth + (slotWidth - barWidth) / 2;
          const completedHeight = heightFor(point.completed);
          const dismissedHeight = heightFor(point.dismissed);
          const baselineY = margin.top + plotHeight;
          const completedY = baselineY - completedHeight;
          // 2px surface gap between stacked segments.
          const dismissedY = completedY - (point.completed > 0 ? 2 : 0) - dismissedHeight;
          return (
            <g key={point.date}>
              {point.completed > 0 && (
                <path
                  d={
                    point.dismissed > 0
                      ? `M ${x} ${completedY} H ${x + barWidth} V ${baselineY} H ${x} Z`
                      : roundedTopRect(x, completedY, barWidth, completedHeight)
                  }
                  fill={SERIES.completed.color}
                />
              )}
              {point.dismissed > 0 && (
                <path
                  d={roundedTopRect(x, dismissedY, barWidth, dismissedHeight)}
                  fill={SERIES.dismissed.color}
                />
              )}
              {index % labelEvery === 0 && (
                <text
                  x={margin.left + index * slotWidth + slotWidth / 2}
                  y={height - 6}
                  textAnchor="middle"
                  className="chart-tick"
                >
                  {trendDateLabel(point.date)}
                </text>
              )}
              <rect
                x={margin.left + index * slotWidth}
                y={margin.top}
                width={slotWidth}
                height={plotHeight}
                fill="transparent"
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          );
        })}
      </svg>
      {hovered !== null && (
        <div
          className="chart-tooltip"
          style={{ left: `${((margin.left + (hovered + 0.5) * slotWidth) / width) * 100}%` }}
        >
          <strong>{trendDateLabel(points[hovered].date)}</strong>
          <div>Completed: {points[hovered].completed}</div>
          <div>Dismissed: {points[hovered].dismissed}</div>
        </div>
      )}
      <details className="chart-table">
        <summary className="muted">View as table</summary>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Completed</th>
              <th>Dismissed</th>
            </tr>
          </thead>
          <tbody>
            {points
              .filter((point) => point.completed > 0 || point.dismissed > 0)
              .map((point) => (
                <tr key={point.date}>
                  <td>{point.date}</td>
                  <td>{point.completed}</td>
                  <td>{point.dismissed}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function TodoAnalyticsCard({ todo }: { todo: TodoAnalytics }): React.JSX.Element {
  return (
    <div className="card" data-testid="todo-analytics-card">
      <div className="occurrence-title">
        <span className="occurrence-name">{todo.todoName}</span>
        <span className="muted">
          {todo.total} occurrence{todo.total === 1 ? '' : 's'}
        </span>
      </div>
      <div className="form-row" style={{ marginTop: 8 }}>
        <div className="form-field">
          <span className="stat-label">
            {formatPercent(todo.completionRate)} completed ({todo.completed})
          </span>
          <Meter rate={todo.completionRate ?? 0} color="#1e8e4e" track="#e6f4ec" />
        </div>
        <div className="form-field">
          <span className="stat-label">
            {formatPercent(todo.dismissRate)} dismissed ({todo.dismissed})
          </span>
          <Meter rate={todo.dismissRate ?? 0} color="#c93a3a" track="#fbeaea" />
        </div>
      </div>
      {todo.bestHour && (
        <div className="insight" data-testid="best-hour-insight">
          You&apos;re most consistent with {todo.todoName.toLowerCase()} at{' '}
          {formatHourOfDay(todo.bestHour.hour)} ({todo.bestHour.completed}/{todo.bestHour.total}{' '}
          completed)
        </div>
      )}
    </div>
  );
}

function ReasonBreakdown({ summary }: { summary: AnalyticsSummary }): React.JSX.Element | null {
  const reasons = summary.dismissReasonBreakdown;
  if (reasons.length === 0) {
    return null;
  }
  const max = Math.max(...reasons.map((reason) => reason.count));
  return (
    <>
      <h2 className="section-title">Dismissal reasons</h2>
      <div className="card">
        {reasons.map((reason) => (
          <div key={reason.reason} className="reason-bar-row">
            <span className="reason-bar-label">{reason.reason}</span>
            <div className="reason-bar-track">
              <div
                className="reason-bar-fill"
                style={{ width: `${(reason.count / max) * 100}%` }}
              />
            </div>
            <span className="reason-bar-count">{reason.count}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function AnalyticsView(): React.JSX.Element {
  const version = useDataVersion();
  const [rangeDays, setRangeDays] = useState<number>(30);
  const { data: summary } = useAsyncData(
    () => api.getAnalytics(rangeDays),
    [version, rangeDays],
  );

  return (
    <div className="view">
      <div className="view-header">
        <h1 className="view-title">Analytics</h1>
        <div className="occurrence-actions">
          {RANGE_OPTIONS.map((days) => (
            <button
              key={days}
              type="button"
              className={`btn btn-small ${rangeDays === days ? 'btn-primary' : ''}`}
              onClick={() => setRangeDays(days)}
            >
              {days} days
            </button>
          ))}
        </div>
      </div>

      {summary && summary.totals.occurrences === 0 && (
        <div className="empty-state" data-testid="analytics-empty">
          <div className="empty-state-icon">📈</div>
          <h2>No data yet</h2>
          <p className="muted">Analytics appear once occurrences start happening.</p>
        </div>
      )}

      {summary && summary.totals.occurrences > 0 && (
        <>
          <div className="stat-row" data-testid="analytics-totals">
            <StatTile label="Occurrences" value={summary.totals.occurrences} />
            <StatTile label="Completed" value={summary.totals.completed} />
            <StatTile label="Dismissed" value={summary.totals.dismissed} />
            <StatTile label="Snoozes" value={summary.totals.snoozeEvents} />
            <StatTile label="Still pending" value={summary.totals.pending} />
          </div>

          <h2 className="section-title">Daily trend</h2>
          <TrendChart points={summary.dailyTrend} />

          <h2 className="section-title">Per todo</h2>
          {summary.todos.map((todo) => (
            <TodoAnalyticsCard key={todo.todoId} todo={todo} />
          ))}

          <ReasonBreakdown summary={summary} />
        </>
      )}
    </div>
  );
}
