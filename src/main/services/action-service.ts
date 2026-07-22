import type { EventRepository } from '../db/event-repository';
import type { ActionRepository } from '../db/action-repository';
import type { Action } from '../../shared/types';

export interface ActionServiceDeps {
  actions: ActionRepository;
  events: EventRepository;
  now: () => Date;
}

/**
 * All state transitions for actions. Every transition appends to the
 * action_events table so history and analytics can be rebuilt from events.
 */
export function createActionService(deps: ActionServiceDeps) {
  const iso = (): string => deps.now().toISOString();

  return {
    /**
     * Creates a pending action for a schedule fire, or returns null when
     * one already exists for that fire time (dedupe on restart/catch-up).
     */
    createFromSchedule(
      todoId: number,
      scheduleId: number,
      title: string,
      scheduledAt: Date,
    ): Action | null {
      const scheduledAtIso = scheduledAt.toISOString();
      if (deps.actions.existsForFire(scheduleId, scheduledAtIso)) {
        return null;
      }
      const action = deps.actions.create({
        source: 'schedule',
        todoId,
        scheduleId,
        title,
        scheduledAt: scheduledAtIso,
        createdAt: iso(),
      });
      deps.events.append(action.id, 'created', { scheduledAt: scheduledAtIso }, iso());
      return action;
    },

    /** Creates a pending action from an ingested markdown file. */
    createFromFile(title: string, bodyMd: string): Action {
      const scheduledAtIso = iso();
      const action = deps.actions.create({
        source: 'file',
        todoId: null,
        scheduleId: null,
        title,
        bodyMd,
        scheduledAt: scheduledAtIso,
        createdAt: scheduledAtIso,
      });
      deps.events.append(action.id, 'created', { source: 'file' }, scheduledAtIso);
      return action;
    },

    complete(id: number): Action {
      const timestamp = iso();
      const action = deps.actions.setStatus(id, {
        status: 'completed',
        completedAt: timestamp,
        snoozedUntil: null,
      });
      deps.events.append(id, 'completed', {}, timestamp);
      return action;
    },

    dismiss(id: number, reason: string): Action {
      const timestamp = iso();
      const action = deps.actions.setStatus(id, {
        status: 'dismissed',
        dismissedAt: timestamp,
        dismissReason: reason,
        snoozedUntil: null,
      });
      deps.events.append(id, 'dismissed', { reason }, timestamp);
      return action;
    },

    snooze(id: number, minutes: number): Action {
      if (minutes <= 0) {
        throw new Error(`Snooze minutes must be positive, got ${minutes}`);
      }
      const timestamp = iso();
      const until = new Date(deps.now().getTime() + minutes * 60_000).toISOString();
      const action = deps.actions.setStatus(id, {
        status: 'snoozed',
        snoozedUntil: until,
      });
      deps.events.append(id, 'snoozed', { minutes, until }, timestamp);
      return action;
    },

    /** Returns snoozed actions whose snooze elapsed, now pending again. */
    reopenDueSnoozes(): Action[] {
      const due = deps.actions.listSnoozedDue(iso());
      return due.map((action) => {
        const reopened = deps.actions.setStatus(action.id, {
          status: 'pending',
          snoozedUntil: null,
        });
        deps.events.append(action.id, 'reopened', { from: 'snooze' }, iso());
        return reopened;
      });
    },

    /** Permanently removes an action and its event history (sudo purge). */
    delete(id: number): void {
      deps.actions.delete(id);
    },
  };
}

export type ActionService = ReturnType<typeof createActionService>;
