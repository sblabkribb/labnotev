import { describe, it, expect } from 'vitest';

describe('Unit Operations', () => {
  describe('UNIT_OPERATIONS', () => {
    it('should have hardware operations', async () => {
      const { UNIT_OPERATIONS } = await import('../lib/unitOperations');
      
      const hwOps = UNIT_OPERATIONS.filter(op => op.category === 'Hardware');
      
      expect(hwOps.length).toBeGreaterThan(0);
      expect(hwOps[0].id).toMatch(/^OPHW-/);
    });

    it('should have software operations', async () => {
      const { UNIT_OPERATIONS } = await import('../lib/unitOperations');
      
      const swOps = UNIT_OPERATIONS.filter(op => op.category === 'Software');
      
      expect(swOps.length).toBeGreaterThan(0);
      expect(swOps[0].id).toMatch(/^OPSW-/);
    });

    it('should have required fields for each operation', async () => {
      const { UNIT_OPERATIONS } = await import('../lib/unitOperations');
      
      for (const op of UNIT_OPERATIONS) {
        expect(op.id).toBeDefined();
        expect(op.name).toBeDefined();
        expect(op.description).toBeDefined();
        expect(op.category).toMatch(/^(Hardware|Software)$/);
      }
    });
  });

  describe('getOperationsByCategory', () => {
    it('should return only hardware operations when category is Hardware', async () => {
      const { getOperationsByCategory } = await import('../lib/unitOperations');
      
      const result = getOperationsByCategory('Hardware');
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(op => op.category === 'Hardware')).toBe(true);
    });

    it('should return only software operations when category is Software', async () => {
      const { getOperationsByCategory } = await import('../lib/unitOperations');
      
      const result = getOperationsByCategory('Software');
      
      expect(result.length).toBeGreaterThan(0);
      expect(result.every(op => op.category === 'Software')).toBe(true);
    });

    it('should return 20 hardware operations', async () => {
      const { getOperationsByCategory } = await import('../lib/unitOperations');
      
      const result = getOperationsByCategory('Hardware');
      
      expect(result.length).toBe(20);
    });

    it('should return 15 software operations', async () => {
      const { getOperationsByCategory } = await import('../lib/unitOperations');
      
      const result = getOperationsByCategory('Software');
      
      expect(result.length).toBe(15);
    });
  });
});
