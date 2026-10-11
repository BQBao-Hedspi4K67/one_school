# ONE SCHOOL backend

NestJS API for ONE SCHOOL. The backend owns authentication, authorization,
survey data, campus-level scoring and the server-side AI adapter.

## Local development

Run these commands from the repository root after copying `.env.example` to
`.env` and starting PostgreSQL:

```powershell
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:backend
```

The health check is available at
`http://localhost:3000/api/health`.

## Commands

```powershell
npm run build
npm run lint
npm run format
npm run test
```

`DATABASE_URL`, JWT secrets and the optional AI provider key are read only from
the backend environment. Never expose `AI_API_KEY` through a `VITE_*` variable.
