interface VSCodeApi {
  postMessage(message: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VSCodeApi;

export type MessageHandler = (message: {
  type: string;
  [key: string]: unknown;
}) => void;

/**
 * Sample record structure (matching extension's SampleRecord)
 */
export interface SampleRecord {
  type: string;
  alias: string | null;
  descriptions: string[];
  sources: string[];
}

/**
 * Input for saving a sample
 */
export interface SaveSampleInput {
  sampleType: string;
  sampleId: string;
  alias: string | null;
  description: string | null;
}

class VSCodeBridge {
  private api: VSCodeApi;
  private handlers: Set<MessageHandler> = new Set();
  private pendingRequests: Map<string, (value: unknown) => void> = new Map();

  constructor() {
    this.api = acquireVsCodeApi();
    
    window.addEventListener('message', (event) => {
      const message = event.data;
      
      // Handle async responses
      if (message.requestId && this.pendingRequests.has(message.requestId)) {
        const resolve = this.pendingRequests.get(message.requestId)!;
        this.pendingRequests.delete(message.requestId);
        resolve(message);
        return;
      }
      
      // Notify all handlers
      this.handlers.forEach((handler) => handler(message));
    });
  }

  postMessage(message: unknown): void {
    this.api.postMessage(message);
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.add(handler);
  }

  offMessage(handler: MessageHandler): void {
    this.handlers.delete(handler);
  }

  async request<T>(message: { type: string; [key: string]: unknown }): Promise<T> {
    const requestId = Math.random().toString(36).substring(7);
    
    return new Promise((resolve) => {
      this.pendingRequests.set(requestId, resolve as (value: unknown) => void);
      this.api.postMessage({ ...message, requestId });
    });
  }

  getState<T>(): T | undefined {
    return this.api.getState() as T | undefined;
  }

  setState<T>(state: T): void {
    this.api.setState(state);
  }

  /**
   * Load samples of a specific type from the extension
   */
  async loadSamples(sampleType: string): Promise<Record<string, SampleRecord>> {
    const response = await this.request<{ samples: Record<string, SampleRecord> }>({
      type: 'getSamples',
      sampleType,
    });
    return response.samples;
  }

  /**
   * Save a sample to the extension's storage
   */
  async saveSample(input: SaveSampleInput): Promise<{ success: boolean }> {
    const response = await this.request<{ success: boolean }>({
      type: 'saveSample',
      sampleType: input.sampleType,
      sampleId: input.sampleId,
      alias: input.alias,
      description: input.description,
    });
    return response;
  }
}

export const vscode = new VSCodeBridge();
