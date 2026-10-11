# ONE SCHOOL

ONE SCHOOL helps a school compare the main campus and branch campus, identify
gaps from survey data, organize improvement events and measure results before
and after each event.

## Requirements

- Node.js 20.19+ (or 22.12+)
- npm 10+
- Docker Desktop (for the local PostgreSQL container)
- A Google Gemini API key is required for live AI analysis. The application
  does not display a fabricated AI result when the provider is unavailable.

## Local setup

1. Copy `.env.example` to `.env`.
2. Start PostgreSQL:

   ```powershell
   docker compose up -d postgres
   ```

3. Install dependencies:

   ```powershell
   npm --prefix frontend install
   npm --prefix backend install
   ```

4. Generate Prisma Client, create the initial migration and seed demo data:

   ```powershell
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

The seed command writes demo accounts, survey responses, events and articles
directly to PostgreSQL. It does not create a fake completed AI analysis; run an
analysis from the dashboard to generate and persist a real result.

5. Start the applications in separate terminals:

   ```powershell
   npm run dev:backend
   npm run dev:frontend
   ```

The backend health endpoint is available at `http://localhost:3000/api/health`.

## Product flow

```text
Teacher creates a baseline survey
→ Students from both campuses respond
→ Statistics by criterion and campus
→ AI identifies gaps, summarizes open-text feedback and proposes a solution/activity
→ Teacher creates and publishes an event
→ Students request/confirm participation
→ Post-event survey using the same criteria
→ Before/after effectiveness comparison
→ AI proposes the next improvement
```

Students select `MAIN` (điểm chính) or `BRANCH` (phân hiệu) during registration.
Dashboard comparisons are aggregated by campus and never compare individual
students.

Demo accounts use the password `DemoPassword123!`:

- `teacher.demo@example.com`
- `student.main.demo@example.com` — main campus
- `student.branch.demo@example.com` — branch campus

Do not use the demo password or placeholder secrets in production.

## AI analysis configuration

ONE SCHOOL uses Google Gemini through the provider's OpenAI-compatible API.
The integration runs through a backend-only adapter:

- `AI_API_BASE_URL` defaults to the Google Gemini OpenAI-compatible endpoint.
- `AI_MODEL` selects the Gemini/Gemma model.
- `AI_API_KEY` is stored only in the backend environment.
- The frontend must call ONE SCHOOL backend endpoints and must never receive
  `AI_API_KEY` through a `VITE_*` variable.

The adapter will receive only campus/criterion/question aggregates and sanitized
open-text responses. It may summarize recurring themes and basic sentiment
(positive/neutral/negative), but it does not receive student identity data.
Deterministic weighted scores remain the source of truth; AI output is persisted
as an insight with retryable status and does not replace the score or the
teacher's decision.
# one_school
