import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockVSCodeApi } from './setup';

// Re-import vscode after mocking
let vscode: typeof import('../vscodeApi').vscode;

describe('vscodeApi', () => {
  beforeEach(async () => {
    vi.resetModules();
    const module = await import('../vscodeApi');
    vscode = module.vscode;
  });

  describe('postMessage', () => {
    it('should call VSCode API postMessage', () => {
      const message = { type: 'test', data: 'hello' };
      vscode.postMessage(message);
      
      expect(mockVSCodeApi.postMessage).toHaveBeenCalledWith(message);
    });

    it('should handle multiple postMessage calls', () => {
      vscode.postMessage({ type: 'first' });
      vscode.postMessage({ type: 'second' });
      
      expect(mockVSCodeApi.postMessage).toHaveBeenCalledTimes(2);
    });
  });

  describe('onMessage', () => {
    it('should register message handler', () => {
      const handler = vi.fn();
      vscode.onMessage(handler);
      
      // Simulate message from VSCode
      const event = new MessageEvent('message', {
        data: { type: 'update', content: 'test' },
      });
      window.dispatchEvent(event);
      
      expect(handler).toHaveBeenCalledWith({ type: 'update', content: 'test' });
    });

    it('should support multiple handlers', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      vscode.onMessage(handler1);
      vscode.onMessage(handler2);
      
      const event = new MessageEvent('message', {
        data: { type: 'test' },
      });
      window.dispatchEvent(event);
      
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('offMessage', () => {
    it('should unregister message handler', () => {
      const handler = vi.fn();
      vscode.onMessage(handler);
      vscode.offMessage(handler);
      
      const event = new MessageEvent('message', {
        data: { type: 'test' },
      });
      window.dispatchEvent(event);
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('request', () => {
    it('should send request and return promise', async () => {
      const requestPromise = vscode.request<{ uri: string }>({
        type: 'getAssetUri',
        relativePath: './assets/image.png',
      });
      
      // Check that postMessage was called with requestId
      expect(mockVSCodeApi.postMessage).toHaveBeenCalled();
      const calledWith = mockVSCodeApi.postMessage.mock.calls[0][0] as {
        type: string;
        requestId: string;
        relativePath: string;
      };
      expect(calledWith.type).toBe('getAssetUri');
      expect(calledWith.requestId).toBeDefined();
      
      // Simulate response
      const responseEvent = new MessageEvent('message', {
        data: { requestId: calledWith.requestId, uri: 'vscode-resource://path' },
      });
      window.dispatchEvent(responseEvent);
      
      const result = await requestPromise;
      expect(result.uri).toBe('vscode-resource://path');
    });
  });

  describe('getState / setState', () => {
    it('should call VSCode API setState', () => {
      const state = { lastSaved: Date.now() };
      vscode.setState(state);
      
      expect(mockVSCodeApi.setState).toHaveBeenCalledWith(state);
    });

    it('should call VSCode API getState', () => {
      mockVSCodeApi.getState.mockReturnValue({ lastSaved: 12345 });
      
      const state = vscode.getState<{ lastSaved: number }>();
      
      expect(mockVSCodeApi.getState).toHaveBeenCalled();
      expect(state?.lastSaved).toBe(12345);
    });

    it('should return undefined when no state', () => {
      mockVSCodeApi.getState.mockReturnValue(undefined);
      
      const state = vscode.getState();
      
      expect(state).toBeUndefined();
    });
  });
});
