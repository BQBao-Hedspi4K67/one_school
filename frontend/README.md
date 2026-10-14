# ONE SCHOOL frontend

React, TypeScript and Vite client for ONE SCHOOL. Feature work should keep
data access behind the backend API and must not expose backend-only secrets.

## Local development

From the repository root:

```powershell
npm --prefix frontend install
npm run dev:frontend
```

API requests use the current origin by default. In development, Vite proxies
`/api` to the local backend; this also lets a Cloudflare Tunnel expose the
frontend and API together without sending remote devices to their own
`localhost`. Start a temporary tunnel with:

```powershell
cloudflared tunnel --url http://localhost:5173
```

Bind and host validation are configured to permit Cloudflare quick-tunnel
hostnames. If the frontend and backend are deployed on separate public hosts,
set `VITE_API_URL` to the backend's public origin (for example,
`https://api.example.com`) at frontend build time.
Production builds are created with:

```powershell
npm run build:frontend
```
