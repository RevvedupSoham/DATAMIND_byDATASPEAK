# DataMind — Account Management

DataMind now has three roles:

- **Owner** — manages the workspace, HR/Managers, Employees, and database operations.
- **HR/Manager** — operates the database.
- **Employee** — read-only database access.

For the initial setup, run `setup.sql` first and then `auth_setup.sql` in the Supabase SQL Editor.

## Demo accounts

The setup creates:

- Owner: `owner` / `change-me-owner`
- HR/Manager: `hr_manager` / `change-me-hr_manager`
- Employee: `workforce` / `change-me-workforce`

Change all demo passwords before sharing the application.

## Account creation

Owners can create HR/Manager and Employee accounts from the Owner Dashboard. Passwords are hashed by PostgreSQL through `hash_datamind_password()` and are never stored as plaintext.

For emergency/manual management, use the SQL Editor and `crypt()`:

```sql
insert into employee_users (username, password_hash)
values ('newusername', crypt('their-password', gen_salt('bf')));

insert into hr_manager_users (username, password_hash)
values ('newusername', crypt('their-password', gen_salt('bf')));
```

Do not insert a plaintext value into `password_hash`.

## Change a password manually

```sql
update employee_users
set password_hash = crypt('their-new-password', gen_salt('bf'))
where username = 'theirusername';

update hr_manager_users
set password_hash = crypt('their-new-password', gen_salt('bf'))
where username = 'theirusername';

update owner_users
set password_hash = crypt('their-new-password', gen_salt('bf'))
where username = 'theirusername';
```

## Disable or reactivate an account

```sql
update employee_users set is_active = false where username = 'theirusername';
update employee_users set is_active = true where username = 'theirusername';

update hr_manager_users set is_active = false where username = 'theirusername';
update hr_manager_users set is_active = true where username = 'theirusername';
```

Owner accounts should be changed carefully because the application intentionally keeps a simple single-owner model.
