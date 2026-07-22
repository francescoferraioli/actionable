import { basename, extname } from 'node:path';
import type { Action } from '../../shared/types';
import type { ActionService } from './action-service';

/** Derives an inbox title from a markdown filename. */
export function titleFromMarkdownFilename(filename: string): string | null {
  if (extname(filename).toLowerCase() !== '.md') {
    return null;
  }
  const stem = basename(filename, extname(filename));
  if (!stem) {
    return null;
  }
  return stem.replace(/[-_]+/g, ' ').trim();
}

export interface FolderWatcherDeps {
  actionService: ActionService;
  getInboxFolder: () => string | null;
  readFile: (path: string) => string;
  unlink: (path: string) => void;
  watch: (folder: string, onFile: (filename: string) => void) => () => void;
  onActionsCreated: (actions: Action[]) => void;
}

/**
 * Watches a configured folder for new markdown files. Each file becomes a
 * pending action and is deleted immediately after ingestion.
 */
export function createFolderWatcherService(deps: FolderWatcherDeps) {
  let stopWatching: (() => void) | null = null;
  const processing = new Set<string>();

  const ingest = (folder: string, filename: string): void => {
    const title = titleFromMarkdownFilename(filename);
    if (!title) {
      return;
    }
    const key = `${folder}/${filename}`;
    if (processing.has(key)) {
      return;
    }
    processing.add(key);
    try {
      const path = `${folder}/${filename}`;
      const bodyMd = deps.readFile(path);
      const action = deps.actionService.createFromFile(title, bodyMd);
      deps.unlink(path);
      deps.onActionsCreated([action]);
    } catch {
      // File may still be writing or already removed; ignore and retry on next event.
    } finally {
      processing.delete(key);
    }
  };

  return {
    start(listFiles: (folder: string) => string[]): void {
      this.stop();
      const folder = deps.getInboxFolder();
      if (!folder) {
        return;
      }

      listFiles(folder).forEach((filename) => ingest(folder, filename));

      stopWatching = deps.watch(folder, (filename) => ingest(folder, filename));
    },

    stop(): void {
      stopWatching?.();
      stopWatching = null;
    },

    rescan(listFiles: (folder: string) => string[]): void {
      const folder = deps.getInboxFolder();
      if (!folder) {
        return;
      }
      listFiles(folder).forEach((filename) => ingest(folder, filename));
    },
  };
}

export type FolderWatcherService = ReturnType<typeof createFolderWatcherService>;
