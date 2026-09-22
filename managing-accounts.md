# DataMind — Account Management

DataMind currently uses three roles:

- **Owner** — manages the workspace and managed accounts, inspects database metadata, and reviews activity.
- **HR/Manager** — database operator with read and approved write access.
- **Employee** — read-only database access.

Run `setup.sql` first and `auth_setup.sql` second in the existing Supabase project.

## Demo accounts

The current `auth_setup.sql` seeds:

- Owner: `owner` / `change-me-owner`
- HR/Manager: `admin` / `change-me-admin`
- Employee: `member` / `change-me-member`

Change these passwords before using the application outside a local/demo environment.

## Owner account management

Sign in as the Owner and open **Owner Dashboard**.

The dashboard provides separate management sections for:

### Employees

Owners can:

- create employee accounts
- activate or deactivate employee accounts
- reset employee passwords
- remove employee accounts

### HR/Managers

Owners can:

- create HR/Manager accounts
- activate or deactivate HR/Manager accounts
- reset HR/Manager passwords
- remove HR/Manager accounts

Passwords are hashed server-side through PostgreSQL's `hash_datamind_password()` function. Plaintext passwords are not stored in the account tables.

## Account tables

Authentication uses separate tables:

- `owner_users`
- `hr_manager_users`
- `employee_users`

Managed employee and HR/Manager accounts contain:

- username
- password hash
- display name
- workforce ID where applicable
- active/inactive status
- creation timestamp

The Owner account is kept separate from the managed workforce accounts.

## Manual password changes

If manual database administration is required, use PostgreSQL `crypt()` rather than writing plaintext into `password_hash`.

Example:

```sql
update employee_users
set password_hash = crypt('new-password', gen_salt('bf'))
where username = 'member';

update hr_manager_users
set password_hash = crypt('new-password', gen_salt('bf'))
where username = 'admin';

update owner_users
set password_hash = crypt('new-password', gen_salt('bf'))
where username = 'owner';
```

## Disable or reactivate an account

```sql
update employee_users
set is_active = false
where username = 'member';

update employee_users
set is_active = true
where username = 'member';

update hr_manager_users
set is_active = false
where username = 'admin';

update hr_manager_users
set is_active = true
where username = 'admin';

update owner_users
set is_active = false
where username = 'owner';

update owner_users
set is_active = true
where username = 'owner';
```

Use Owner account changes carefully because Owner access controls the workspace management surface.

## Authentication functions

`auth_setup.sql` provides separate database functions for credential verification:

- `verify_owner_login()`
- `verify_hr_manager_login()`
- `verify_employee_login()`

The application selects the appropriate verification function according to the login panel and then creates a signed session only after successful verification.

## Security notes

- Never store plaintext passwords.
- Never expose the Supabase secret/service-role key to the browser.
- Change all seeded demo passwords.
- Do not grant browser roles direct access to the account tables.
- Do not treat a client-provided role as proof of authorization.
- Keep `SESSION_SECRET` private and sufficiently random.
