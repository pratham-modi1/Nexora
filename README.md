# Nexora (frontend + Aureus backend)

```
nexora-app/
  frontend/   Vite + TypeScript UI  (http://localhost:5173)
  backend/    Spring Boot API       (http://localhost:8080)  — CORS already configured
```

## Prerequisites
Java 17+ (or whatever your pom targets), Node 18+, and MySQL running with a database named `aureus`
(credentials in `backend/src/main/resources/application.properties`).

## Run both
```
npm run setup     # once: installs root + frontend deps
npm run dev       # starts backend and frontend together
```
Open http://localhost:5173. Register a new account, then log in.

Run separately: `npm run backend` / `npm run frontend`.

## Config
- `frontend/.env`: `VITE_API_URL=http://localhost:8080`, `VITE_DEMO=false` (`true` = fake data, no backend).
- Production CORS: set `aureus.cors.allowed-origins=https://your-site.com` in `application.properties`.

## Admin
Log in as the seeded admin (`admin@aureus.com`, from `V2__seed_system.sql`). Admins get an **Admin** page instead of Home/Activity/Goals
(an admin has no wallet): reverse a transaction by ID (`NX-000123` or `123`) and run the ledger reconciliation check.
Make another admin by setting `role='ADMIN'` on a user in the database.

## Ledger
User transaction sheets show a debit and a credit entry derived from the transaction (the API doesn't expose the ledger table).
The real ledger audit is the admin reconciliation.

## Clean build (if the backend fails with ClassNotFound)
`cd backend && mvn clean spring-boot:run`
