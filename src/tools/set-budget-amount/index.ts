// ----------------------------
// SET BUDGET AMOUNT TOOL
// ----------------------------

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { success, errorFromCatch } from '../../utils/response.js';
import { setBudgetAmount } from '../../actual-api.js';
import { getCategories } from '../../actual-api.js';
import { formatAmount } from '../../utils.js';
import { type ToolInput } from '../../types.js';

// Define schema for the arguments
const SetBudgetAmountArgsSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format')
    .describe('Month in YYYY-MM format (e.g., "2026-02")'),
  categoryId: z.string().describe('Category UUID'),
  amount: z.number().int().describe('Budget amount as an integer in cents (e.g., 130000 for $1,300.00)'),
});

export type SetBudgetAmountArgs = z.infer<typeof SetBudgetAmountArgsSchema>;

export const schema = {
  name: 'set-budget-amount',
  description: 'Set the budgeted amount for a single category in a given month.',
  inputSchema: zodToJsonSchema(SetBudgetAmountArgsSchema) as ToolInput,
};

export async function handler(args: SetBudgetAmountArgs): Promise<CallToolResult> {
  try {
    // Validate with Zod schema
    const validatedArgs = SetBudgetAmountArgsSchema.parse(args);
    const { month, categoryId, amount } = validatedArgs;

    // Get category name for confirmation message
    const categories = await getCategories();
    const category = categories.find((c) => c.id === categoryId);
    const categoryName = category ? category.name : categoryId;

    // Set the budget amount (this also calls sync internally)
    await setBudgetAmount(month, categoryId, amount);

    // Return confirmation
    const formattedAmount = formatAmount(amount);
    return success(
      `Successfully set budget for "${categoryName}" to ${formattedAmount} for ${month}`
    );
  } catch (err) {
    return errorFromCatch(err);
  }
}
