import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockVscode } from './setup';

// Import after mocking
import { activate } from '../extension';

describe('Sample ID Highlighting', () => {
  let mockContext: {
    subscriptions: Array<{ dispose: () => void }>;
    extensionUri: { fsPath: string };
    extensionPath: string;
  };

  beforeEach(() => {
    mockContext = {
      subscriptions: [],
      extensionUri: {
        fsPath: '/test/extension',
      },
      extensionPath: '/test/extension',
    };
  });

  describe('Sample Type Colors', () => {
    it('should have colors defined for all sample types', async () => {
      // Import after vscode mock is set up
      const { sampleTypeColors } = await import('../labsample/constants/decorations');
      const { SAMPLE_TYPES } = await import('../labsample/constants/appConstants');
      
      for (const type of SAMPLE_TYPES) {
        expect(sampleTypeColors[type]).toBeDefined();
        expect(sampleTypeColors[type]).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('should have unique colors for each sample type', async () => {
      const { sampleTypeColors } = await import('../labsample/constants/decorations');
      
      const colors = Object.values(sampleTypeColors);
      const uniqueColors = new Set(colors);
      
      expect(uniqueColors.size).toBe(colors.length);
    });
  });

  describe('Extension activation with highlighting', () => {
    it('should register onDidChangeActiveTextEditor handler', () => {
      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      expect(mockVscode.window.onDidChangeActiveTextEditor).toHaveBeenCalled();
    });

    it('should add highlight subscription to context', () => {
      const initialLength = mockContext.subscriptions.length;
      
      activate(mockContext as unknown as Parameters<typeof activate>[0]);

      // Should have multiple subscriptions including highlight handlers
      expect(mockContext.subscriptions.length).toBeGreaterThan(initialLength);
    });
  });

  describe('Sample ID pattern matching', () => {
    it('should match DNA sample ID pattern', () => {
      const pattern = /^DNA-\d+$/;
      
      expect(pattern.test('DNA-1737123456789')).toBe(true);
      expect(pattern.test('DNA-123')).toBe(true);
      expect(pattern.test('RNA-123')).toBe(false);
      expect(pattern.test('DNA-abc')).toBe(false);
    });

    it('should match RNA sample ID pattern', () => {
      const pattern = /^RNA-\d+$/;
      
      expect(pattern.test('RNA-1737123456789')).toBe(true);
      expect(pattern.test('RNA-123')).toBe(true);
      expect(pattern.test('DNA-123')).toBe(false);
    });

    it('should match Protein sample ID pattern', () => {
      const pattern = /^Protein-\d+$/;
      
      expect(pattern.test('Protein-1737123456789')).toBe(true);
      expect(pattern.test('Protein-123')).toBe(true);
    });

    it('should match Equip sample ID pattern', () => {
      const pattern = /^Equip-\d+$/;
      
      expect(pattern.test('Equip-1737123456789')).toBe(true);
      expect(pattern.test('Equip-123')).toBe(true);
    });
  });
});
