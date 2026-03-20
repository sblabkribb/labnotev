import type { WebviewToExtensionMessage } from './types';

interface VsCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

let api: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi {
  if (!api) {
    api = (window as any).acquireVsCodeApi();
  }
  return api!;
}

export function postMessage(message: WebviewToExtensionMessage): void {
  getVsCodeApi().postMessage(message);
}
