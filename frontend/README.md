# ONE SCHOOL frontend

React, TypeScript and Vite client for ONE SCHOOL. Feature work should keep
data access behind the backend API and must not expose backend-only secrets.

## Local development

From the repository root:

```powershell
npm --prefix frontend install
npm run dev:frontend
```

The Vite development server uses `VITE_API_URL` for the backend base URL.
Production builds are created with:

```powershell
npm run build:frontend
```
