# ProdSync RBAC + Project Access Blueprint

## Frontend Structure

- `src/features/auth/auth.store.ts`
  Session state, account cache, permission helpers.
- `src/features/auth/access-control.tsx`
  Frontend access matrix for routes and default redirects.
- `src/features/auth/AuthRouteGate.tsx`
  Public-only and protected route gates.
- `src/features/projects/projects.store.ts`
  Frontend mock state for projects, members, join requests, and active project context.
- `src/modules/projects/views/ProjectsView.tsx`
  Producer vs non-producer Projects Hub UI.

## Database Schema

```sql
create type user_role as enum (
  'EP',
  'LINE_PRODUCER',
  'DIRECTOR',
  'DOP',
  'ART_DIRECTOR',
  'TRANSPORT_CAPTAIN',
  'PRODUCTION_MANAGER',
  'FIRST_AD',
  'FIRST_AC',
  'CREW',
  'DRIVER',
  'DATA_WRANGLER'
);

create type project_stage as enum ('PRE_PRODUCTION', 'SHOOTING', 'POST');
create type request_status as enum ('PENDING', 'APPROVED', 'REJECTED');

create table users (
  user_id uuid primary key,
  name text not null,
  email text unique,
  phone text unique,
  role user_role not null,
  department text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  project_id uuid primary key,
  owner_user_id uuid not null references users(user_id),
  name text not null,
  status project_stage not null,
  budget numeric(14,2) not null,
  location text not null,
  start_date date not null,
  end_date date not null,
  enabled_departments jsonb not null default '[]'::jsonb,
  ot_rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table project_members (
  id uuid primary key,
  user_id uuid not null references users(user_id),
  project_id uuid not null references projects(project_id),
  role user_role not null,
  permissions jsonb not null default '[]'::jsonb,
  approved_by uuid references users(user_id),
  approved_at timestamptz,
  unique (user_id, project_id)
);

create table project_join_requests (
  request_id uuid primary key,
  user_id uuid not null references users(user_id),
  project_id uuid not null references projects(project_id),
  role_requested user_role not null,
  message text,
  status request_status not null default 'PENDING',
  reviewed_by uuid references users(user_id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, project_id, status)
);
```

## API Structure

### Auth

- `POST /api/auth/request-otp`
- `POST /api/auth/verify-otp`
- `GET /api/auth/session`

### Projects

- `GET /api/projects`
  Returns only projects visible to the authenticated user.
- `POST /api/projects`
  Producer roles only.
- `GET /api/projects/:projectId`
  Membership required.
- `POST /api/projects/:projectId/join-requests`
  Non-members only.
- `GET /api/projects/:projectId/join-requests`
  Producer/owner only.
- `POST /api/projects/:projectId/join-requests/:requestId/approve`
  Producer/owner only.
- `POST /api/projects/:projectId/join-requests/:requestId/reject`
  Producer/owner only.

### Protected Modules

- `GET /api/projects/:projectId/dashboard`
- `GET /api/projects/:projectId/transport`
- `GET /api/projects/:projectId/camera`
- `GET /api/projects/:projectId/crew`
- `GET /api/projects/:projectId/expenses`
- `GET /api/projects/:projectId/wardrobe`
- `GET /api/projects/:projectId/approvals`
- `GET /api/projects/:projectId/reports`

Each endpoint must validate both membership and role scope.

## RBAC Middleware

```ts
type RequestUser = {
  userId: string
  role: string
}

async function requireProjectAccess(
  requestUser: RequestUser,
  projectId: string,
  allowedRoles?: string[],
) {
  const membership = await db.project_members.findFirst({
    where: {
      user_id: requestUser.userId,
      project_id: projectId,
    },
  })

  if (!membership) {
    throw new ForbiddenError('Project membership required')
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new ForbiddenError('Role not permitted for this resource')
  }

  return membership
}
```

## Security Rules

- Never trust role data sent by the frontend.
- Resolve role and membership from the database on every protected request.
- Scope every project query by `project_id` and verified membership.
- Producers can approve project access, but operational roles cannot escalate themselves.
- Crew, Drivers, and Data Wranglers must never receive budget or cross-department data.
