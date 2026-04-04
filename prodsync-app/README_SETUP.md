# Frontend Environment Notes

Frontend env file is [prodsync-app/.env](C:\Users\biswa\OneDrive\Desktop\ProdSync-2.0\prodsync-app\.env).

Fill these values before connecting real auth:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_API_BASE_URL`

For local Vite development, set `VITE_API_BASE_URL=/api` so requests and Socket.IO traffic can use the dev proxy.

Current frontend state:

- Auth is Supabase-ready
- Projects hub is the entry gate
- Mock data has been removed from seeded stores/services
- Empty states now wait for real backend data
