Build a desktop application using Electron that acts as an accountability-based todo system.

The core concept:
Unlike traditional reminders, a todo is not considered complete until the user explicitly takes action. Scheduled todos create occurrences that enter an inbox. The user must complete, dismiss, or snooze each occurrence.

The application should feel like an "accountability inbox" for personal commitments.

## Goals

Build a local-first Electron application with:


• Scheduled todo items.
• Desktop notifications.
• Unread state tracking.
• Complete/dismiss/snooze workflow.
• History tracking.
• Analytics based on todo occurrences.

No cloud backend is required initially.

---

# Core Concepts

## Todo Definition

A Todo Definition represents a recurring or one-off commitment.

Example:

"Drink water"

Properties:


• id.
• name.
• description (optional).
• category (optional).
• active status.
• created timestamp.
• updated timestamp.

A todo definition does NOT represent an individual reminder.

---

## Schedule

A Todo Definition can have one or more schedules.

Examples:


• Every hour from 9am-5pm.
• Daily at 7am.
• Weekly Monday at 9am.

Properties:


• id.
• todo_id.
• schedule type.
• schedule configuration.
• timezone.
• active status.

Use a flexible scheduling approach that can support cron-like schedules.

---

## Todo Occurrence

When a schedule triggers, create a Todo Occurrence.

Example:

Todo:
"Drink water"

Occurrences:

9:00 AM - pending
10:00 AM - completed
11:00 AM - dismissed

Properties:


• id.
• todo_id.
• scheduled_at.
• created_at.
• status:.
◦ pending.
◦ completed.
◦ dismissed.
◦ snoozed.
• completed_at.
• dismissed_at.
• snoozed_until.

The occurrence is the thing that gets actioned.

---

# User Workflow

## New Todo Occurrence

When a scheduled todo triggers:


1. Create occurrence.
2. Mark application as unread.
3. Send desktop notification.

Notification example:

"Drink water is due"

Actions:


• Open app.
• Complete.
• Dismiss.
• Snooze.

---

# Unread State

The app has an unread concept similar to email.

Rules:


• Any pending occurrence means the app is unread.
• Completing or dismissing all pending occurrences marks the app as read.

Display:


• Menu bar icon badge.
• App badge count.
• Inbox count.

Example:

3 pending todos = unread count of 3

---

# Actions

## Complete

User marks occurrence as completed.

Store:


• completed timestamp.
• completion event.

---

## Dismiss

User can dismiss an occurrence.

Dismiss requires selecting a reason.

Initial reasons:


• Didn't need it.
• Too busy.
• Forgot.
• Already did it.
• Wrong timing.
• Other.

Store:


• dismissal reason.
• timestamp.

Reasons should be extensible.

---

## Snooze

User can snooze an occurrence.

Options:


• 5 minutes.
• 15 minutes.
• 1 hour.
• Custom time.

Behaviour:


• Remove from active inbox temporarily.
• Create a new scheduled trigger.
• When snooze time arrives:.
◦ notify again.
◦ occurrence becomes pending again.

Track snooze history.

---

# History Page

Create a history view showing:


• Completed todos.
• Dismissed todos.
• Snoozed occurrences.

Filters:


• Date range.
• Todo.
• Category.
• Status.

Example:

Today:

✓ Drink water 9:00
✓ Stretch 10:00
✗ Exercise dismissed (too busy)

---

# Analytics Page

Create analytics based on occurrences.

Initial analytics:

## Completion rate

Example:

Drink water:
85% completed

## Dismiss rate

Example:

Exercise:
40% dismissed

## Best performing times

Example:

"You're most consistent with exercise at 7am"

## Todo trends

Example:

Last 30 days:

Completed:
120

Dismissed:
20

Snoozed:
15

---

# Data Model

Use SQLite.

Suggested tables:

todos


• id.
• name.
• description.
• category.
• active.
• created_at.
• updated_at.


schedules


• id.
• todo_id.
• schedule_expression.
• timezone.
• active.


occurrences


• id.
• todo_id.
• schedule_id.
• scheduled_at.
• status.
• completed_at.
• dismissed_at.
• snoozed_until.
• created_at.


occurrence_events

Event sourcing table.

Stores every action:


• id.
• occurrence_id.
• event_type.
◦ created.
◦ completed.
◦ dismissed.
◦ snoozed.
◦ reopened.
• metadata JSON.
• timestamp.

This should allow future analytics.

---

# Technical Requirements

Use:


• Electron.
• React renderer.
• TypeScript.
• SQLite.
• Clean separation between:.
◦ renderer.
◦ main process.
◦ database layer.
◦ scheduler service.
◦ notification service.

The scheduler should run reliably even when the app window is closed.

Use OS notifications.

---

# UI Requirements

Main views:

## Inbox

Shows pending occurrences.

Example:

TODAY

3 outstanding


• Drink water.
  Due 10 minutes ago

Actions:
Complete
Dismiss
Snooze


## Todos

Manage todo definitions.

Create/edit/delete todos.

Configure schedules.


## History

View previous occurrences.


## Analytics

Charts and insights.

---

# Future Considerations

Design the architecture so these can be added later:


• AI recommendations.
• Habit optimisation.
• Suggested schedule changes.
• Weekly reviews.
• Adaptive scheduling.
• Natural language todo creation.

Do not implement these yet.

---

# Development Approach

Start with an MVP:

Phase 1:

• Electron setup.
• SQLite.
• Todo CRUD.
• Scheduling.
• Occurrence creation.
• Notifications.

Phase 2:

• Complete/dismiss/snooze workflows.
• Unread state.

Phase 3:

• History.

Phase 4:

• Analytics.

Prioritise a clean architecture over excessive features.