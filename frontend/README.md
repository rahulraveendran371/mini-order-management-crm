# Mini Order Management CRM — Frontend

A React-based dashboard for managing Shopify orders. The frontend communicates with a NestJS backend to display order information, search and filter orders, and view individual order details.

## Features

- Display orders in a dashboard table.
- Show order summary information.
- Search orders by order number, customer name, or email.
- Filter orders by financial status.
- View individual order details and line items.
- Retrieve order data from the backend REST API.
- Responsive layout for different screen sizes.
- Loading and error states for API requests.

## Tech Stack

- React
- Vite
- JavaScript
- CSS
- Fetch API

## Prerequisites

- Node.js
- npm
- Backend API running locally

## Installation

From the project root, navigate to the frontend directory:

```bash
cd frontend
npm install
```

## Configuration

The frontend connects to the NestJS backend at:

`http://localhost:3000`

Ensure the backend is running and CORS is enabled.

If the API URL is configured directly in the source code, update it to match your backend URL when deploying to another environment.

## Run the Development Server

```bash
npm run dev
```

Open the local URL displayed in the terminal, usually:

`http://localhost:5173`

## Build for Production

```bash
npm run build
```

## Preview the Production Build

```bash
npm run preview
```

## Backend API Endpoints Used

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/orders` | Fetch orders and line items |
| GET | `/orders/:id` | Fetch an individual order |
| POST | `/orders/sync` | Trigger Shopify order synchronization |

The frontend uses the orders endpoint to populate the dashboard. Order synchronization is handled by the backend.

## Project Structure

```text
frontend/
├── public/
├── src/
│   ├── App.jsx
│   ├── App.css
│   └── main.jsx
├── index.html
├── package.json
└── README.md
```

## Troubleshooting

- **Orders are not displayed:** Ensure the backend is running and `GET /orders` returns data.
- **Network or CORS errors:** Check the backend URL and CORS configuration.
- **Empty dashboard:** Confirm that orders have been synchronized to PostgreSQL.
- **Build errors:** Run `npm install` and review the terminal output.

## License

Developed as part of the Mini Order Management CRM assignment.