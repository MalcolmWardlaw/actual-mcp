import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler, schema } from './index.js';

vi.mock('../../actual-api.js', () => ({
  getBudgetMonth: vi.fn(),
}));

import { getBudgetMonth } from '../../actual-api.js';

describe('get-budget-month tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('schema', () => {
    it('should have correct name and description', () => {
      expect(schema.name).toBe('get-budget-month');
      expect(schema.description).toContain('budgeted amounts');
    });

    it('should have inputSchema defined', () => {
      expect(schema.inputSchema).toBeDefined();
      expect(schema.inputSchema.type).toBe('object');
    });
  });

  describe('handler - happy path', () => {
    it('should retrieve and format budget data for a valid month', async () => {
      const mockBudgetData = {
        month: '2026-01',
        categoryGroups: [
          {
            id: 'group-1',
            name: 'Usual Expenses',
            is_income: false,
            categories: [
              { id: 'cat-1', name: 'Food', budgeted: 130000, activity: -141800 },
              { id: 'cat-2', name: 'Shopping', budgeted: 50000, activity: -72900 },
            ],
          },
        ],
      };

      vi.mocked(getBudgetMonth).mockResolvedValue(mockBudgetData);

      const result = await handler({ month: '2026-01' });

      expect(getBudgetMonth).toHaveBeenCalledWith('2026-01');
      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('Budget for 2026-01');
      expect(text).toContain('Usual Expenses');
      expect(text).toContain('Food');
      expect(text).toContain('Shopping');
    });

    it('should handle budget data with no category groups', async () => {
      const mockBudgetData = {
        month: '2026-02',
        categoryGroups: [],
      };

      vi.mocked(getBudgetMonth).mockResolvedValue(mockBudgetData);

      const result = await handler({ month: '2026-02' });

      expect(result.content[0]).toHaveProperty('text');
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain('No budget data found');
    });

    it('should skip income category groups', async () => {
      const mockBudgetData = {
        month: '2026-03',
        categoryGroups: [
          {
            id: 'income-group',
            name: 'Income',
            is_income: true,
            categories: [{ id: 'cat-income', name: 'Salary', budgeted: 0, activity: 500000 }],
          },
          {
            id: 'expense-group',
            name: 'Expenses',
            is_income: false,
            categories: [{ id: 'cat-exp', name: 'Rent', budgeted: 200000, activity: -200000 }],
          },
        ],
      };

      vi.mocked(getBudgetMonth).mockResolvedValue(mockBudgetData);

      const result = await handler({ month: '2026-03' });

      const text = (result.content[0] as { text: string }).text;
      expect(text).not.toContain('Income');
      expect(text).not.toContain('Salary');
      expect(text).toContain('Expenses');
      expect(text).toContain('Rent');
    });
  });

  describe('handler - validation errors', () => {
    it('should return error when month format is invalid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await handler({ month: '2026/01' } as any);

      expect(result.isError).toBe(true);
      expect(getBudgetMonth).not.toHaveBeenCalled();
    });

    it('should return error when month is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await handler({} as any);

      expect(result.isError).toBe(true);
      expect(getBudgetMonth).not.toHaveBeenCalled();
    });
  });

  describe('handler - API errors', () => {
    it('should handle API errors', async () => {
      vi.mocked(getBudgetMonth).mockRejectedValue(new Error('API error'));

      const result = await handler({ month: '2026-01' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('API error');
    });

    it('should handle network errors', async () => {
      vi.mocked(getBudgetMonth).mockRejectedValue(new Error('Network connection failed'));

      const result = await handler({ month: '2026-01' });

      expect(result.isError).toBe(true);
      expect((result.content[0] as { text: string }).text).toContain('Network connection failed');
    });
  });
});
