/**
 * TypeScript types for the Actual Budget internal API.
 *
 * Entity types are derived from https://actualbudget.org/docs/api/reference.
 * Internal fields (tombstone, schedule virtual fields, preferences) are
 * inferred from observed query responses in this extension.
 */

// ── Primitives ────────────────────────────────────────────────────

/** ISO date string: YYYY-MM-DD */
export type ISODate = string;

/** ISO month string: YYYY-MM */
export type ISOMonth = string;

/** UUID */
export type UUID = string;

/**
 * Currency amount as a signed integer in minor units (cents for USD).
 * e.g. $12.34 = 1234, -$0.50 = -50
 */
export type AmountInCents = number;

// ── Entities ──────────────────────────────────────────────────────

export type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "investment"
  | "mortgage"
  | "debt"
  | "other";

export interface Account {
  id: UUID;
  name: string;
  type: AccountType;
  offbudget: boolean;
  closed: boolean;
  tombstone?: boolean;
}

export interface Category {
  id: UUID;
  name: string;
  /** ID of the parent CategoryGroup */
  group_id: UUID;
  is_income: boolean;
  hidden?: boolean;
  sort_order?: number;
  tombstone?: boolean;
}

export interface CategoryGroup {
  id: UUID;
  name: string;
  is_income: boolean;
  sort_order?: number;
  tombstone?: boolean;
  /** Populated when queried via getCategoryGroups() with nested option */
  categories?: Category[];
}

export interface Transaction {
  id: UUID;
  account: UUID;
  date: ISODate;
  amount: AmountInCents;
  payee?: UUID | null;
  /** Only present on create — resolved to payee id afterwards */
  payee_name?: string | null;
  imported_payee?: string | null;
  category?: UUID | null;
  notes?: string | null;
  imported_id?: string | null;
  transfer_id?: UUID | null;
  cleared?: boolean;
  tombstone?: boolean;
  is_parent?: boolean;
  is_child?: boolean;
  parent_id?: UUID | null;
  /** ID of the schedule that generated this transaction */
  schedule?: UUID | null;
  /** Only present on split transactions */
  subtransactions?: Transaction[];
}

export interface Payee {
  id: UUID;
  name: string;
  category?: UUID | null;
  /** Set when this payee represents a transfer to another account */
  transfer_acct?: UUID | null;
  tombstone?: boolean;
}

export type RuleStage = "pre" | "default" | "post";
export type RuleConditionsOp = "and" | "or";

export interface ConditionOrAction {
  field: string;
  op: string;
  value: unknown;
}

export interface Rule {
  id: UUID;
  stage: RuleStage;
  conditionsOp?: RuleConditionsOp;
  conditions?: ConditionOrAction[];
  actions?: ConditionOrAction[];
}

export type ScheduleAmountOp = "is" | "isapprox" | "isbetween";
export type RecurFrequency = "daily" | "weekly" | "monthly" | "yearly";
export type RecurEndMode = "never" | "after_n_occurrences" | "on_date";
export type WeekendSolveMode = "before" | "after";

export interface RecurPattern {
  type?: string;
  value?: number;
}

export interface RecurConfig {
  frequency: RecurFrequency;
  start: string;
  endMode: RecurEndMode;
  interval?: number;
  patterns?: RecurPattern[];
  skipWeekend?: boolean;
  endOccurrences?: number;
  endDate?: string;
  weekendSolveMode?: WeekendSolveMode;
}

export interface Schedule {
  id: UUID;
  name?: string | null;
  rule?: UUID | null;
  next_date?: ISODate | null;
  completed?: boolean;
  posts_transaction?: boolean;
  tombstone?: boolean;
  /**
   * Virtual fields — populated when select("*") is used.
   * These are denormalized from the schedule's rule conditions.
   */
  _payee?: UUID | null;
  _account?: UUID | null;
  _amount?: AmountInCents | { num1: AmountInCents; num2: AmountInCents } | null;
  _amountOp?: ScheduleAmountOp | null;
  _date?: ISODate | RecurConfig | null;
}

export interface Note {
  id: UUID;
  note: string;
}

export interface Preference {
  id: string;
  value: string;
}

export interface Tag {
  id: UUID;
  tag: string;
  color?: string | null;
  description?: string | null;
  hidden?: boolean;
  tombstone?: boolean;
}

// ── Table map ────────────────────────────────────────────────────

/**
 * Maps queryable table names to their row types.
 *
 * @example
 * query<ActualTable["categories"][]>("categories")
 * query<Pick<ActualTable["accounts"], "id" | "offbudget">[]>("accounts")
 */
export interface ActualTable {
  accounts: Account;
  categories: Category;
  category_groups: CategoryGroup;
  transactions: Transaction;
  payees: Payee;
  schedules: Schedule;
  notes: Note;
  preferences: Preference;
  tags: Tag;
  rules: Rule;
}

export type TableName = keyof ActualTable;

// ── Budget sheet cells ────────────────────────────────────────────

/**
 * Budget sheet name format: `budget${YYYYMM}`, e.g. `budget202506`.
 *
 * Usage: send("get-cell", { sheetName: `budget${ym}`, name: "available-funds" })
 */
export type BudgetSheetName = `budget${number}`;

export type BudgetCellName =
  | "available-funds"          // Total available to budget ("To Budget")
  | "to-budget"                // Alias for available-funds
  | "last-month-overspent"     // Overspent amount carried from previous month
  | "total-budgeted"           // Sum of all category budgeted amounts
  | "buffered-selected"        // Amount held for next month
  | `budget-${UUID}`           // Budgeted amount for a specific category
  | `leftover-${UUID}`         // Remaining (available) for a specific category
  | `goal-${UUID}`             // Goal amount for a specific category
  | `sum-amount-${UUID}`;      // Total spent for a specific category

/** Response shape from send("get-cell", { sheetName, name }) */
export interface CellValue {
  value: AmountInCents;
}

// ── Internal send methods ────────────────────────────────────────

/**
 * Typed overloads for the send() bridge function.
 * Covers the internal methods this extension uses.
 */
export interface SendMethodMap {
  "get-cell": {
    args: { sheetName: BudgetSheetName | string; name: BudgetCellName | string };
    result: CellValue;
  };
  "category-update": {
    args: { id: UUID; name?: string; group_id?: UUID; is_income?: boolean; hidden?: boolean };
    result: null;
  };
  "budget/dry-run-category-template": {
    args: { month: ISOMonth; categoryId: UUID; template: string };
    result: unknown;
  };
}

export type SendMethod = keyof SendMethodMap;
