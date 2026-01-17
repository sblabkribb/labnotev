import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePasteHandler } from '../hooks/usePasteHandler';

// Mock BlockNote editor
const createMockEditor = () => ({
  getTextCursorPosition: vi.fn(() => ({
    block: { id: 'current-block' },
  })),
  insertBlocks: vi.fn(),
});

// Helper to create mock ClipboardEvent
const createPasteEvent = (options: {
  files?: File[];
  items?: Array<{ type: string; getAsFile: () => File | null }>;
  textPlain?: string;
  textHtml?: string;
}) => {
  const dataTransfer = {
    files: options.files || [],
    items: options.items || [],
    getData: (type: string) => {
      if (type === 'text/plain') return options.textPlain || '';
      if (type === 'text/html') return options.textHtml || '';
      return '';
    },
  };

  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', {
    value: dataTransfer,
    writable: false,
  });

  return event;
};

// Mock FileReader
const mockFileReader = {
  result: 'data:image/png;base64,mockBase64Data',
  readAsDataURL: vi.fn(function (this: typeof mockFileReader) {
    setTimeout(() => {
      if (this.onload) {
        this.onload({ target: this } as unknown as ProgressEvent<FileReader>);
      }
    }, 0);
  }),
  onload: null as ((event: ProgressEvent<FileReader>) => void) | null,
  onerror: null as ((event: ProgressEvent<FileReader>) => void) | null,
};

describe('usePasteHandler', () => {
  let mockEditor: ReturnType<typeof createMockEditor>;
  let mockOnSaveImage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockEditor = createMockEditor();
    mockOnSaveImage = vi.fn().mockResolvedValue('./assets/test.png');
    
    // Mock FileReader
    vi.stubGlobal('FileReader', vi.fn(() => mockFileReader));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('event listener registration', () => {
    it('should add paste event listener on mount', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
      
      renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));
      
      // Check that paste event listener is added with capture phase (true)
      expect(addEventListenerSpy).toHaveBeenCalledWith('paste', expect.any(Function), true);
      addEventListenerSpy.mockRestore();
    });

    it('should remove paste event listener on unmount', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      
      const { unmount } = renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));
      
      unmount();
      
      // Check that paste event listener is removed with capture phase (true)
      expect(removeEventListenerSpy).toHaveBeenCalledWith('paste', expect.any(Function), true);
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('image file handling', () => {
    it('should handle image file from clipboard files', async () => {
      renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));

      const imageFile = new File([''], 'test.png', { type: 'image/png' });
      const event = createPasteEvent({ files: [imageFile] });

      await act(async () => {
        document.dispatchEvent(event);
        await waitFor(() => expect(mockOnSaveImage).toHaveBeenCalled());
      });

      expect(event.defaultPrevented).toBe(true);
      expect(mockOnSaveImage).toHaveBeenCalledWith('mockBase64Data', expect.stringMatching(/^\d+_[a-z0-9]+\.png$/));
    });

    it('should handle image from clipboard items', async () => {
      const imageFile = new File([''], 'screenshot.png', { type: 'image/png' });
      
      renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));

      const event = createPasteEvent({
        items: [{ type: 'image/png', getAsFile: () => imageFile }],
      });

      await act(async () => {
        document.dispatchEvent(event);
        await waitFor(() => expect(mockOnSaveImage).toHaveBeenCalled());
      });

      expect(event.defaultPrevented).toBe(true);
    });

    it('should insert image block after saving', async () => {
      renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));

      const imageFile = new File([''], 'test.png', { type: 'image/png' });
      const event = createPasteEvent({ files: [imageFile] });

      await act(async () => {
        document.dispatchEvent(event);
        await waitFor(() => expect(mockEditor.insertBlocks).toHaveBeenCalled());
      });

      expect(mockEditor.insertBlocks).toHaveBeenCalledWith(
        [expect.objectContaining({ type: 'image' })],
        { id: 'current-block' },
        'after'
      );
    });
  });

  describe('file type filtering', () => {
    it('should only handle image files', async () => {
      renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));

      const textFile = new File(['hello'], 'test.txt', { type: 'text/plain' });
      const event = createPasteEvent({ files: [textFile] });

      act(() => {
        document.dispatchEvent(event);
      });

      // Should not prevent default for non-image files
      expect(mockOnSaveImage).not.toHaveBeenCalled();
    });

    it('should handle multiple image files', async () => {
      renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));

      const image1 = new File([''], 'test1.png', { type: 'image/png' });
      const image2 = new File([''], 'test2.jpg', { type: 'image/jpeg' });
      const event = createPasteEvent({ files: [image1, image2] });

      await act(async () => {
        document.dispatchEvent(event);
        await waitFor(() => expect(mockOnSaveImage).toHaveBeenCalledTimes(2));
      });
    });
  });

  describe('text handling', () => {
    it('should not prevent default for plain text', () => {
      renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));

      const event = createPasteEvent({ textPlain: 'Hello World' });

      act(() => {
        document.dispatchEvent(event);
      });

      // BlockNote should handle text paste natively
      expect(event.defaultPrevented).toBe(false);
    });

    it('should not prevent default for HTML content', () => {
      renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));

      const event = createPasteEvent({ textHtml: '<p>Hello <strong>World</strong></p>' });

      act(() => {
        document.dispatchEvent(event);
      });

      // BlockNote should handle HTML paste natively
      expect(event.defaultPrevented).toBe(false);
    });
  });

  describe('image extension detection', () => {
    it('should use correct extension for PNG', async () => {
      renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));

      const imageFile = new File([''], 'test.png', { type: 'image/png' });
      const event = createPasteEvent({ files: [imageFile] });

      await act(async () => {
        document.dispatchEvent(event);
        await waitFor(() => expect(mockOnSaveImage).toHaveBeenCalled());
      });

      const filename = mockOnSaveImage.mock.calls[0][1] as string;
      expect(filename).toMatch(/\.png$/);
    });

    it('should use correct extension for JPEG', async () => {
      renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));

      const imageFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
      const event = createPasteEvent({ files: [imageFile] });

      await act(async () => {
        document.dispatchEvent(event);
        await waitFor(() => expect(mockOnSaveImage).toHaveBeenCalled());
      });

      const filename = mockOnSaveImage.mock.calls[0][1] as string;
      expect(filename).toMatch(/\.jpg$/);
    });

    it('should use correct extension for GIF', async () => {
      renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));

      const imageFile = new File([''], 'test.gif', { type: 'image/gif' });
      const event = createPasteEvent({ files: [imageFile] });

      await act(async () => {
        document.dispatchEvent(event);
        await waitFor(() => expect(mockOnSaveImage).toHaveBeenCalled());
      });

      const filename = mockOnSaveImage.mock.calls[0][1] as string;
      expect(filename).toMatch(/\.gif$/);
    });

    it('should use correct extension for WebP', async () => {
      renderHook(() => usePasteHandler({
        editor: mockEditor as unknown as Parameters<typeof usePasteHandler>[0]['editor'],
        onSaveImage: mockOnSaveImage,
      }));

      const imageFile = new File([''], 'test.webp', { type: 'image/webp' });
      const event = createPasteEvent({ files: [imageFile] });

      await act(async () => {
        document.dispatchEvent(event);
        await waitFor(() => expect(mockOnSaveImage).toHaveBeenCalled());
      });

      const filename = mockOnSaveImage.mock.calls[0][1] as string;
      expect(filename).toMatch(/\.webp$/);
    });
  });
});
