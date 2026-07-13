import { contextBridge } from 'electron';

const api = {};

contextBridge.exposeInMainWorld('actionable', api);
