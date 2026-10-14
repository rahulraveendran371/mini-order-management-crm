# Mini Order Management CRM

A mini order management CRM that syncs Shopify orders into PostgreSQL and displays them in a React dashboard.

**Frontend:** React, Vite
**Backend:** NestJS
**Database:** PostgreSQL + Prisma
**Integration:** Shopify Admin REST API and `orders/create` webhooks

Full backend notes live in `backend/README.md`. Frontend notes live in `frontend/README.md`.

## Prerequisites

- Node.js and npm
- PostgreSQL
- A Shopify development store and app credentials (`read_orders` at minimum)

## Setup

### 1. Database

Create a PostgreSQL database named `mini_order_crm`.

### 2. Backend

```bash
cd backend
npm install
```

Copy `backend/.env.example` to `backend/.env` and replace the placeholders with your own values. Do not commit `.env`.

```bash
npx prisma migrate deploy
npx prisma generate
npm run start:dev
```

The API listens on `http://localhost:3000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL, usually `http://localhost:5173`. The dashboard calls `http://localhost:3000` unless you set `VITE_API_URL`.

## API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/orders` | List orders and line items |
| GET | `/orders/:id` | Get one order by internal UUID |
| POST | `/orders/sync` | Pull recent Shopify orders into PostgreSQL |
| POST | `/webhooks/orders-create` | Shopify `orders/create` webhook |

## Shopify webhooks

Point the `orders/create` subscription at a public HTTPS URL, for example an ngrok tunnel:

`https://<your-tunnel>/webhooks/orders-create`

Set `SHOPIFY_WEBHOOK_SECRET` to the webhook signing secret Shopify shows for that subscription. If you omit it, the backend falls back to `SHOPIFY_CLIENT_SECRET` (typical for app-configured webhooks).
