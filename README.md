# SpendSmart — Full-stack expense tracker

## Folder structure

```text
SpendSmart-fixed/
├── backend/
│   ├── middleware/authMiddleware.js
│   ├── models/{Budget.js,Transaction.js,User.js}
│   ├── routes/{authRoutes.js,budgetRoutes.js,transactionRoutes.js}
│   ├── .env.example
│   ├── package.json
│   └── server.js
└── frontend/
    ├── index.html
    ├── style.css
    └── app.js
```

## 1. Configure backend

Open a terminal in `backend` and run:

```bash
npm install
cp .env.example .env
```

Edit `.env` and add your real MongoDB connection string and a long random JWT secret (at least 32 characters). Never upload `.env` or publish your credentials.

## 2. Start the API

```bash
npm run dev
```

Check `http://localhost:5000/api/health`. It should return JSON with `status: "ok"` and `database: "connected"`.

## 3. Start the frontend

Open `frontend/index.html` with VS Code Live Server. The default allowed origin is `http://127.0.0.1:5500`, so use that exact origin. If Live Server uses another port or hostname, update `FRONTEND_ORIGIN` in `backend/.env` to match and restart the backend.

## Notes

- Login uses an HTTP-only cookie; the frontend sends requests with `credentials: 'include'`.
- All transaction and budget endpoints require a logged-in session and scope records to the current user.
- Budget API uses `GET/PUT/DELETE /api/budgets/:month`, where month is `YYYY-MM`.
- This project is a learning portfolio project, not a production financial service. Before production deployment, use HTTPS, configure secure cookies and CORS for the deployed frontend, and add additional security monitoring and tests.
