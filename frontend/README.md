# Nexora frontend (wired to the Aureus Spring Boot backend)

## Run
1. Backend: start MySQL, then `./mvnw spring-boot:run` in `WalletSimulator/aureus` (port 8080).
2. Frontend: `npm install && npm run dev` -> http://localhost:5173 (intro at `/`, app at `/app.html`).
3. `.env`: `VITE_API_URL=http://localhost:8080`, `VITE_DEMO=false`. Set `VITE_DEMO=true` for fake in-browser data without a backend.

## Where things are
- `src/api.ts`       shared fetch + JWT session; login/register (register then auto-logs in)
- `src/app/live.ts`  real API calls, mapped to the shapes the UI expects
- `src/app/mock.ts`  demo data (only used when VITE_DEMO=true)
- `src/app/data.ts`  picks live or mock

## Not available from the backend yet
Change password, ledger entries / request key in the transaction sheet, and a "who am I" endpoint (email is saved at login, role is read from the JWT).
Production CORS: set `aureus.cors.allowed-origins=https://your-site.com` in application.properties.
