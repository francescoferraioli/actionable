import type { ActionableApi } from '../shared/ipc';

declare global {
  interface Window {
    actionable: ActionableApi;
  }
}

export {};
