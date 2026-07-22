import { Notification } from 'electron';
import { formatNotificationBody } from '../../shared/format';

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
    notification.on('failed', (_event, error) => {
      console.error(`[Actionable] Notification failed (${title}): ${error}`);
    });
    notification.show();
  };

  return {
    actionDue(title: string, body: string | null, fileSourced: boolean): void {
      const defaultBody = fileSourced
        ? 'Complete it in Actionable.'
        : 'Complete, dismiss or snooze it in Actionable.';
      show(`${title} is due`, formatNotificationBody(body, defaultBody));
    },

    actionBack(title: string): void {
      show(`${title} is back`, 'The snooze is over. It is waiting in your inbox.');
    },
  };
}

export type NotificationService = ReturnType<typeof createNotificationService>;
