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

  describe('loadSamples', () => {
    it('should send getSamples request and return samples', async () => {
      const requestPromise = vscode.loadSamples('DNA');
      
      // Check that postMessage was called with correct type
      expect(mockVSCodeApi.postMessage).toHaveBeenCalled();
      const calledWith = mockVSCodeApi.postMessage.mock.calls[0][0] as {
        type: string;
        sampleType: string;
        requestId: string;
      };
      expect(calledWith.type).toBe('getSamples');
      expect(calledWith.sampleType).toBe('DNA');
      expect(calledWith.requestId).toBeDefined();
      
      // Simulate response
      const responseEvent = new MessageEvent('message', {
        data: { 
          requestId: calledWith.requestId, 
          samples: {
            'DNA-123': { type: 'DNA', alias: '샘플A', descriptions: ['설명A'], sources: ['test.md'] },
          }
        },
      });
      window.dispatchEvent(responseEvent);
      
      const result = await requestPromise;
      expect(result['DNA-123']).toBeDefined();
      expect(result['DNA-123'].alias).toBe('샘플A');
    });

    it('should return empty object when no samples exist', async () => {
      const requestPromise = vscode.loadSamples('RNA');
      
      const calledWith = mockVSCodeApi.postMessage.mock.calls[0][0] as {
        type: string;
        sampleType: string;
        requestId: string;
      };
      
      // Simulate empty response
      const responseEvent = new MessageEvent('message', {
        data: { 
          requestId: calledWith.requestId, 
          samples: {}
        },
      });
      window.dispatchEvent(responseEvent);
      
      const result = await requestPromise;
      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe('saveSample', () => {
    it('should send saveSample request with sample info', async () => {
      const savePromise = vscode.saveSample({
        sampleType: 'DNA',
        sampleId: 'DNA-789',
        alias: '새샘플',
        description: '새로운 설명',
      });
      
      // Check that postMessage was called with correct data
      expect(mockVSCodeApi.postMessage).toHaveBeenCalled();
      const calledWith = mockVSCodeApi.postMessage.mock.calls[0][0] as {
        type: string;
        sampleType: string;
        sampleId: string;
        alias: string;
        description: string;
        requestId: string;
      };
      expect(calledWith.type).toBe('saveSample');
      expect(calledWith.sampleType).toBe('DNA');
      expect(calledWith.sampleId).toBe('DNA-789');
      expect(calledWith.alias).toBe('새샘플');
      expect(calledWith.description).toBe('새로운 설명');
      
      // Simulate success response
      const responseEvent = new MessageEvent('message', {
        data: { 
          requestId: calledWith.requestId, 
          success: true
        },
      });
      window.dispatchEvent(responseEvent);
      
      const result = await savePromise;
      expect(result.success).toBe(true);
    });

    it('should handle saveSample with null alias and description', async () => {
      const savePromise = vscode.saveSample({
        sampleType: 'RNA',
        sampleId: 'RNA-001',
        alias: null,
        description: null,
      });
      
      const calledWith = mockVSCodeApi.postMessage.mock.calls[0][0] as {
        type: string;
        sampleType: string;
        sampleId: string;
        alias: null;
        description: null;
        requestId: string;
      };
      expect(calledWith.alias).toBeNull();
      expect(calledWith.description).toBeNull();
      
      // Simulate success response
      const responseEvent = new MessageEvent('message', {
        data: { 
          requestId: calledWith.requestId, 
          success: true
        },
      });
      window.dispatchEvent(responseEvent);
      
      const result = await savePromise;
      expect(result.success).toBe(true);
    });
  });
});
