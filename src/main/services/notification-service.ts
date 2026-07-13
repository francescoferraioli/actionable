import { Notification } from 'electron';

export interface NotificationServiceDeps {
  enabled: boolean;
  onOpen: () => void;
}

export function createNotificationService(deps: NotificationServiceDeps) {
  const show = (title: string, body: string): void => {
    if (!deps.enabled || !Notification.isSupported()) {
      return;
    }
    const notification = new Notification({ title, body });
    notification.on('click', deps.onOpen);
    notification.show();
  };

  return {
    occurrenceDue(todoName: string, description: string | null): void {
      show(`${todoName} is due`, description ?? 'Complete, dismiss or snooze it in Actionable.');
    },

    occurrenceBack(todoName: string): void {
      show(`${todoName} is back`, 'The snooze is over. It is waiting in your inbox.');
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
