import { app, Menu, nativeImage, Tray } from 'electron';
import type { OccurrenceRepository } from '../db/occurrence-repository';

export interface UnreadServiceDeps {
  occurrences: OccurrenceRepository;
  onOpen: () => void;
  onQuit: () => void;
}

/**
 * Email-style unread state: any pending occurrence makes the app unread.
 * Reflected on the dock badge and the menu bar (tray) item.
 */
export function createUnreadService(deps: UnreadServiceDeps) {
  let tray: Tray | null = null;

  const trayMenu = (count: number): Menu =>
    Menu.buildFromTemplate([
      { label: count > 0 ? `${count} pending` : 'Inbox zero', enabled: false },
      { type: 'separator' },
      { label: 'Open Actionable', click: deps.onOpen },
      { type: 'separator' },
      { label: 'Quit Actionable', click: deps.onQuit },
    ]);

  const service = {
    count(): number {
      return deps.occurrences.countPending();
    },

    initTray(): void {
      // Empty image: on macOS the tray then renders as a text-only menu bar
      // item driven by setTitle below.
      tray = new Tray(nativeImage.createEmpty());
      tray.setToolTip('Actionable');
      service.refresh();
    },

    refresh(): number {
      const count = service.count();
      app.setBadgeCount(count);
      tray?.setTitle(count > 0 ? `✓ ${count}` : '✓');
      tray?.setContextMenu(trayMenu(count));
      return count;
    },
  };

  return service;
}

export type UnreadService = ReturnType<typeof createUnreadService>;
