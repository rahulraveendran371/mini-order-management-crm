# Mini Order Management CRM

A mini order management CRM that integrates Shopify with a NestJS backend, PostgreSQL database, Prisma ORM, and a React dashboard.

## Features

- Sync orders from Shopify using the Admin API.
- Receive Shopify `orders/create` webhook events.
- Store order and line-item information in PostgreSQL.
- View orders and their details in a React dashboard.
- Search orders by order number, customer name, or email.
- Filter orders by financial status.
- Expose REST API endpoints for order management.

## Tech Stack

**Frontend:** React, Vite, CSS
**Backend:** NestJS, Node.js
**Database:** PostgreSQL
**ORM:** Prisma
**Integration:** Shopify Admin REST API, Shopify Webhooks

## Prerequisites

- Node.js and npm
- PostgreSQL
- A Shopify development store
- Shopify app credentials with the required API permissions

## Project Structure

```text
Mini Order Management/
├── backend/
│   ├── prisma/
│   │   ├── migrations/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── orders/
│   │   ├── prisma/
│   │   └── webhooks/
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    └── package.json
```

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd "Mini Order Management"
```

### 2. Configure the Backend

```bash
cd backend
npm install
```

Create a `.env` file using `.env.example` as a reference and configure the following variables:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/mini_order_crm"
SHOPIFY_STORE_DOMAIN="your-development-store.myshopify.com"
SHOPIFY_CLIENT_ID="your-shopify-client-id"
SHOPIFY_CLIENT_SECRET="your-shopify-client-secret"
SHOPIFY_WEBHOOK_SECRET=""
PORT=3000
```

Replace the placeholder values with your own credentials. Never commit actual secrets to version control.

### 3. Set Up the Database

Create a PostgreSQL database named `mini_order_crm`.

Apply the existing Prisma migrations:

```bash
npx prisma migrate deploy
npx prisma generate
```

### 4. Start the Backend

```bash
npm run start:dev
```

The backend runs at:

`http://localhost:3000`

### 5. Configure and Start the Frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL displayed in the terminal, usually:

`http://localhost:5173`

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/orders` | Retrieve orders and their line items |
| GET | `/orders/:id` | Retrieve an order by its internal UUID |
| POST | `/orders/sync` | Sync orders from Shopify |
| POST | `/webhooks/orders-create` | Receive Shopify order-created webhook events |

## Shopify Integration

The application uses Shopify credentials to request an Admin API access token and retrieve orders. The sync endpoint follows Shopify's pagination links and upserts retrieved orders in PostgreSQL by Shopify order ID, replacing stored line items when an order is updated.

A Shopify `orders/create` webhook subscription sends new order events to `/webhooks/orders-create` through a publicly accessible HTTPS endpoint during development.

For local webhook testing, a tunnelling service such as ngrok can expose the local backend. Configure the webhook URL in Shopify and keep the tunnel running while testing.

Webhook HMAC verification uses `SHOPIFY_WEBHOOK_SECRET` when it is set, and otherwise `SHOPIFY_CLIENT_SECRET`. Use the signing secret that matches how the webhook was created (Admin notification secret vs app client secret).

## Tests

Run the backend unit tests with:

```bash
npm test
```

The Jest configuration runs NestJS's ESM dependencies with Node's experimental VM module support.

## Error Handling

The API returns appropriate HTTP errors for missing orders and invalid webhook requests. Review the backend terminal logs when Shopify authentication, API requests, database operations, or webhook verification fail.

## Security Notes

- Keep `.env` out of version control.
- Do not publish Shopify client secrets, database credentials, or access tokens.
- Use the correct Shopify webhook signing secret for HMAC verification.
- Use test data when demonstrating the application.

## License

This project was developed as a mini order management CRM assignment.