export type UserRole = "owner" | "hr_manager" | "employee";

export interface SessionPayload {
  username: string;
  role: UserRole;
  /** Workforce/person id associated with this authenticated account. Null for Owner. */
  workforceId: number | null;
  /** Unix seconds. */
  iat: number;
  /** Unix seconds. */
  exp: number;
}

export interface LoginRequestBody {
  username: string;
  password: string;
  /** Which role-specific login panel was selected. */
  panel: UserRole;
}

export interface SessionUser {
  username: string;
  role: UserRole;
  workforceId: number | null;
}
