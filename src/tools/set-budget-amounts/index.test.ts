import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler, schema } from './index.js';

vi.mock('../../actual-api.js', () => ({
  setBudgetAmountNoSync: vi.fn(),
  syncBudget: vi.fn(),
  getCategories: vi.fn(),
}));

import { setBudgetAmountNoSync, syncBudget, getCategories } from '../../actual-api.js';

describe('set-budget-amounts tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('schema', () => {
    it('should have correct name and description', () => {
      expect(schema.name).toBe('set-budget-amounts');
      expect(schema.description).toContain('multiple categories');
    });

    it('should have inputSchema defined', () => {
      expect(schema.inputSchema).toBeDefined();
      expect(schema.inputSchema.type).toBe('object');
    });
  });

  describe('handler - happy path', () => {
    it('should set multiple budget amounts and sync once', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Food' },
        { id: 'cat-2', name: 'Shopping' },
        { id: 'cat-3', name: 'Transport' },
      ];

      vi.mocked(getCategories).mockResolvedValue(mockCategories as any);
      vi.mocked(setBudgetAmountNoSync).mockResolvedValue(undefined);
      vi.mocked(syncBudget).mockResolvedValue(undefined);

      const result = await handler({
        month: '2026-02',
        amounts: [
          { categoryId: 'cat-1', amount: 130000 },
          { categoryId: 'cat-2', amount: 50000 },
        ],
      });

      // Verify each setBudgetAmountNoSync was called
      expect(setBudgetAmountNoSync).toHaveBeenCalledTimes(2);
      expect(setBudgetAmountNoSync).toHaveBeenCalledWith('2026-02', 'cat-1', 130000);
      expect(setBudgetAmountNoSync).toHaveBeenCalledWith('2026-02', 'cat-2', 50000);

      // Verify sync was called once
      expect(syncBudget).toHaveBeenCalledTimes(1);

      // Verify result
      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('2 budget amount(s)');
      expect(text).toContain('Food');
      expect(text).toContain('Shopping');
      expect(text).toContain('$1,300');
      expect(text).toContain('$500');
    });

    it('should handle single amount in batch', async () => {
      const mockCategories = [{ id: 'cat-1', name: 'Food' }];

      vi.mocked(getCategories).mockResolvedValue(mockCategories as any);
      vi.mocked(setBudgetAmountNoSync).mockResolvedValue(undefined);
      vi.mocked(syncBudget).mockResolvedValue(undefined);

      const result = await handler({
        month: '2026-02',
        amounts: [{ categoryId: 'cat-1', amount: 100000 }],
      });

      expect(setBudgetAmountNoSync).toHaveBeenCalledTimes(1);
      expect(syncBudget).toHaveBeenCalledTimes(1);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('1 budget amount(s)');
    });

    it('should handle categories not found by using categoryId', async () => {
      vi.mocked(getCategories).mockResolvedValue([]);
      vi.mocked(setBudgetAmountNoSync).mockResolvedValue(undefined);
      vi.mocked(syncBudget).mockResolvedValue(undefined);

      const result = await handler({
        month: '2026-02',
        amounts: [
          { categoryId: 'unknown-1', amount: 10000 },
          { categoryId: 'unknown-2', amount: 20000 },
        ],
      });

      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('unknown-1');
      expect(text).toContain('unknown-2');
    });
  });

  describe('handler - validation errors', () => {
    it('should return error when month format is invalid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await handler({ month: '2026/02', amounts: [{ categoryId: 'cat-1', amount: 100 }] } as any);

      expect(result.isError).toBe(true);
      expect(setBudgetAmountNoSync).not.toHaveBeenCalled();
      expect(syncBudget).not.toHaveBeenCalled();
    });

    it('should return error when amounts array is empty', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await handler({ month: '2026-02', amounts: [] } as any);

      expect(result.isError).toBe(true);
      expect(setBudgetAmountNoSync).not.toHaveBeenCalled();
      expect(syncBudget).not.toHaveBeenCalled();
    });

    it('should return error when amount is not an integer', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await handler({ month: '2026-02', amounts: [{ categoryId: 'cat-1', amount: 100.5 }] } as any);

      expect(result.isError).toBe(true);
      expect(setBudgetAmountNoSync).not.toHaveBeenCalled();
    });
  });

  describe('handler - API errors', () => {
    it('should handle setBudgetAmountNoSync errors', async () => {
      vi.mocked(getCategories).mockResolvedValue([{ id: 'cat-1', name: 'Food' }] as any);
      vi.mocked(setBudgetAmountNoSync).mockRejectedValue(new Error('Failed to set budget'));

      const result = await handler({
        month: '2026-02',
        amounts: [{ categoryId: 'cat-1', amount: 100000 }],
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Failed to set budget');
    });

    it('should handle syncBudget errors', async () => {
      vi.mocked(getCategories).mockResolvedValue([{ id: 'cat-1', name: 'Food' }] as any);
      vi.mocked(setBudgetAmountNoSync).mockResolvedValue(undefined);
      vi.mocked(syncBudget).mockRejectedValue(new Error('Sync failed'));

      const result = await handler({
        month: '2026-02',
        amounts: [{ categoryId: 'cat-1', amount: 100000 }],
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Sync failed');
    });

    it('should handle getCategories errors', async () => {
      vi.mocked(getCategories).mockRejectedValue(new Error('Failed to fetch categories'));

      const result = await handler({
        month: '2026-02',
        amounts: [{ categoryId: 'cat-1', amount: 100000 }],
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Failed to fetch categories');
    });
  });
});
