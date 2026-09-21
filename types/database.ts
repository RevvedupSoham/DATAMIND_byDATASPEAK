/**
 * Types describing the verified Supabase schema.
 * This mirrors the actual database structure (see lib/sql/schema.ts for the
 * single source of truth used when prompting the LLM). Keep this in sync if
 * the schema changes.
 */

export interface WorkforceRow {
  id: number;
  name: string;
  hire_date: string; // ISO date
  manager_id: number | null;
  dept_id: number | null;
}

export interface DepartmentRow {
  id: number;
  name: string;
  location: string | null;
  head_of_workforce: number | null;
}

export interface SalaryRow {
  workforce_id: number;
  amount: number;
  currency: string;
  effective_from: string; // ISO date
}

export interface AddressRow {
  workforce_id: number;
  city: string | null;
  state: string | null;
  pin_code: string | null;
}

export interface JobHistoryRow {
  id: number;
  workforce_id: number;
  old_role: string | null;
  new_role: string | null;
  changed_on: string; // ISO date
}

export interface DeptAssignmentRow {
  workforce_id: number;
  dept_id: number;
  allocation_percent: number;
}

/** A single column definition as reported by the schema introspection. */
export interface ColumnDefinition {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey?: boolean;
  references?: { table: string; column: string };
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
}

export type DatabaseSchema = TableDefinition[];
