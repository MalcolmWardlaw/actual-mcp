// ----------------------------
// GET BUDGET MONTH TOOL
// ----------------------------

import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { success, errorFromCatch } from '../../utils/response.js';
import { getBudgetMonth } from '../../actual-api.js';
import { formatAmount } from '../../utils.js';
import { type ToolInput } from '../../types.js';

// Define schema for the arguments
const GetBudgetMonthArgsSchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month must be in YYYY-MM format')
    .describe('Month in YYYY-MM format (e.g., "2026-01")'),
});

export type GetBudgetMonthArgs = z.infer<typeof GetBudgetMonthArgsSchema>;

export const schema = {
  name: 'get-budget-month',
  description: 'Retrieve all budgeted amounts for a given month, showing category groups with their budgeted and spent amounts.',
  inputSchema: zodToJsonSchema(GetBudgetMonthArgsSchema) as ToolInput,
};

/**
 * Format budget data as readable tables grouped by category group
 *
 * @param budgetData - The budget data returned from the API
 * @param month - The month being displayed
 * @returns Formatted text representation
 */
function formatBudgetMonth(budgetData: any, month: string): string {
  let output = `Budget for ${month}\n\n`;

  if (!budgetData.categoryGroups || budgetData.categoryGroups.length === 0) {
    return output + 'No budget data found for this month.';
  }

  for (const group of budgetData.categoryGroups) {
    // Skip income category groups (typically shown differently)
    if (group.is_income) {
      continue;
    }

    output += `## ${group.name}\n`;
    output += '| Category | Budgeted | Spent |\n';
    output += '|----------|----------|-------|\n';

    if (group.categories && group.categories.length > 0) {
      for (const category of group.categories) {
        const budgeted = formatAmount(category.budgeted || 0);
        const spent = formatAmount(Math.abs(category.activity || 0));
        output += `| ${category.name} | ${budgeted} | ${spent} |\n`;
      }
    }

    output += '\n';
  }

  return output;
}

export async function handler(args: GetBudgetMonthArgs): Promise<CallToolResult> {
  try {
    // Validate with Zod schema
    const validatedArgs = GetBudgetMonthArgsSchema.parse(args);
    const { month } = validatedArgs;

    // Fetch budget data
    const budgetData = await getBudgetMonth(month);

    // Format and return
    const formattedOutput = formatBudgetMonth(budgetData, month);
    return success(formattedOutput);
  } catch (err) {
    return errorFromCatch(err);
  }
}
