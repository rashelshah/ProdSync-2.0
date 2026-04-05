# ProdSync Backend

Backend foundation for the production RBAC and project-isolation flow.

## Required env

Use [backend/.env](C:\Users\biswa\OneDrive\Desktop\ProdSync-2.0\backend\.env) and fill:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `PORT`
- `CLIENT_ORIGIN` (optional, defaults to `http://localhost:5173`)

## Commands

- `npm install`
- `npm run dev`
- `npm run build`

## Transport rollout

Apply [database/migrations/001_transport_module_hardening.sql](C:\Users\biswa\OneDrive\Desktop\ProdSync-2.0\database\migrations\001_transport_module_hardening.sql) before exercising the transport endpoints in a real environment. The new backend expects the added trip, fuel-log, and geofence columns plus the active-trip indexes from that migration.

## Current scope

- Supabase clients
- auth middleware
- role middleware
- project-access middleware
- modular route structure
- transport fleet, trips, fuel audit, alerts, and Socket.io realtime

## Next feature order

1. Auth/profile sync from `auth.users` to `public.users`
2. Projects and memberships
3. Join-request approval flow
4. Module APIs one by one
