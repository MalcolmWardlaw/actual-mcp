import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler, schema } from './index.js';

vi.mock('../../actual-api.js', () => ({
  setBudgetAmount: vi.fn(),
  getCategories: vi.fn(),
}));

import { setBudgetAmount, getCategories } from '../../actual-api.js';

describe('set-budget-amount tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('schema', () => {
    it('should have correct name and description', () => {
      expect(schema.name).toBe('set-budget-amount');
      expect(schema.description).toContain('budgeted amount');
    });

    it('should have inputSchema defined', () => {
      expect(schema.inputSchema).toBeDefined();
      expect(schema.inputSchema.type).toBe('object');
    });
  });

  describe('handler - happy path', () => {
    it('should set budget amount for a valid category', async () => {
      const mockCategories = [
        { id: 'cat-1', name: 'Food' },
        { id: 'cat-2', name: 'Shopping' },
      ];

      vi.mocked(getCategories).mockResolvedValue(mockCategories as any);
      vi.mocked(setBudgetAmount).mockResolvedValue(undefined);

      const result = await handler({
        month: '2026-02',
        categoryId: 'cat-1',
        amount: 130000,
      });

      expect(setBudgetAmount).toHaveBeenCalledWith('2026-02', 'cat-1', 130000);
      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Food');
      expect(text).toContain('2026-02');
      expect(text).toContain('$1,300');
    });

    it('should handle category not found by using categoryId', async () => {
      vi.mocked(getCategories).mockResolvedValue([]);
      vi.mocked(setBudgetAmount).mockResolvedValue(undefined);

      const result = await handler({
        month: '2026-02',
        categoryId: 'unknown-cat',
        amount: 50000,
      });

      expect(setBudgetAmount).toHaveBeenCalledWith('2026-02', 'unknown-cat', 50000);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('unknown-cat');
    });

    it('should handle zero amount', async () => {
      const mockCategories = [{ id: 'cat-1', name: 'Food' }];

      vi.mocked(getCategories).mockResolvedValue(mockCategories as any);
      vi.mocked(setBudgetAmount).mockResolvedValue(undefined);

      const result = await handler({
        month: '2026-02',
        categoryId: 'cat-1',
        amount: 0,
      });

      expect(setBudgetAmount).toHaveBeenCalledWith('2026-02', 'cat-1', 0);
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('$0');
    });
  });

  describe('handler - validation errors', () => {
    it('should return error when month format is invalid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await handler({ month: '2026/02', categoryId: 'cat-1', amount: 100 } as any);

      expect(result.isError).toBe(true);
      expect(setBudgetAmount).not.toHaveBeenCalled();
    });

    it('should return error when categoryId is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await handler({ month: '2026-02', amount: 100 } as any);

      expect(result.isError).toBe(true);
      expect(setBudgetAmount).not.toHaveBeenCalled();
    });

    it('should return error when amount is not an integer', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await handler({ month: '2026-02', categoryId: 'cat-1', amount: 100.5 } as any);

      expect(result.isError).toBe(true);
      expect(setBudgetAmount).not.toHaveBeenCalled();
    });
  });

  describe('handler - API errors', () => {
    it('should handle setBudgetAmount errors', async () => {
      vi.mocked(getCategories).mockResolvedValue([{ id: 'cat-1', name: 'Food' }] as any);
      vi.mocked(setBudgetAmount).mockRejectedValue(new Error('Failed to set budget'));

      const result = await handler({
        month: '2026-02',
        categoryId: 'cat-1',
        amount: 100000,
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Failed to set budget');
    });

    it('should handle getCategories errors', async () => {
      vi.mocked(getCategories).mockRejectedValue(new Error('Failed to fetch categories'));

      const result = await handler({
        month: '2026-02',
        categoryId: 'cat-1',
        amount: 100000,
      });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Failed to fetch categories');
    });
  });
});
