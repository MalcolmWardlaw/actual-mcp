// ----------------------------
// SET BUDGET AMOUNTS (BATCH) TOOL
// ----------------------------

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { success, errorFromCatch } from '../../utils/response.js';
import { setBudgetAmountNoSync, syncBudget, getCategories } from '../../actual-api.js';
import { formatAmount } from '../../utils.js';
import { type ToolInput } from '../../types.js';

// Define schema for a single budget amount entry
const BudgetAmountEntrySchema = z.object({
  categoryId: z.string().describe('Category UUID'),
  amount: z.number().int().describe('Budget amount as an integer in cents (e.g., 130000 for $1,300.00)'),
});

// Define schema for the arguments
const SetBudgetAmountsArgsSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format')
    .describe('Month in YYYY-MM format (e.g., "2026-02")'),
  amounts: z
    .array(BudgetAmountEntrySchema)
    .min(1, 'amounts array must contain at least one entry')
    .describe('Array of budget amounts to set'),
});

export type SetBudgetAmountsArgs = z.infer<typeof SetBudgetAmountsArgsSchema>;

export const schema = {
  name: 'set-budget-amounts',
  description: 'Set budgeted amounts for multiple categories in a single call.',
  inputSchema: zodToJsonSchema(SetBudgetAmountsArgsSchema) as ToolInput,
};

export async function handler(args: SetBudgetAmountsArgs): Promise<CallToolResult> {
  try {
    // Validate with Zod schema
    const validatedArgs = SetBudgetAmountsArgsSchema.parse(args);
    const { month, amounts } = validatedArgs;

    // Get all categories for name lookup
    const categories = await getCategories();
    const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

    // Set all budget amounts without syncing
    const results: string[] = [];
    for (const entry of amounts) {
      await setBudgetAmountNoSync(month, entry.categoryId, entry.amount);

      const categoryName = categoryMap.get(entry.categoryId) || entry.categoryId;
      const formattedAmount = formatAmount(entry.amount);
      results.push(`  - ${categoryName}: ${formattedAmount}`);
    }

    // Sync once after all updates
    await syncBudget();

    // Return confirmation
    const summary = `Successfully set ${amounts.length} budget amount(s) for ${month}:\n${results.join('\n')}`;
    return success(summary);
  } catch (err) {
    return errorFromCatch(err);
  }
}
