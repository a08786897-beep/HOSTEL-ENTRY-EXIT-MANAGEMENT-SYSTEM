# Hostel Entry & Exit Management System

## Run locally

1. Install the existing backend dependencies: `cd Backend` then `npm install`.
2. Set `MONGO_URI` and a private, random `JWT_SECRET` in `Backend/.env` (see `.env.example`).
3. Start the API with `npm start`; it connects to MongoDB before listening on port `3000`.
4. Open this workspace with VS Code Live Server. The workspace settings serve `Frontend` at `http://127.0.0.1:5500/`. Alternatively, run `python -m http.server 5500 --bind 127.0.0.1 --directory Frontend` from the repository root.
5. Register a student account. To set up the first administrator, use `npm run bootstrap-admin -- registered.email@example.com` from `Backend`; subsequent roles can be assigned in the Admin dashboard.

Warden, security guard, and additional administrator accounts are registered as students first, then assigned their trusted role by an administrator. The role is always loaded from the database, never accepted from public registration.

## Tests

Run `npm test` from `Backend`. With `MONGO_URI` and `JWT_SECRET` configured, the workflow test temporarily creates isolated accounts and applications in the configured database and removes those test records when it finishes.
