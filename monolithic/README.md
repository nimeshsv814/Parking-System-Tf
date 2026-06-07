# Smart Parking Monolithic Application

This folder migrates the existing microservices into a 3-tier application without changing the original service folders.

## Tiers

- `frontend`: React/Vite app served by Nginx.
- `backend`: Single Express API that contains auth, parking, booking, payment, notification, and scheduler logic.
- `database`: MongoDB container with one `smartparking` database and an init script.

## API Prefixes

The public routes keep the same gateway-style prefixes used by the existing frontend:

- `/auth`
- `/parking`
- `/booking`
- `/payment`
- `/notification`

Nginx serves the React app and proxies those API prefixes to the backend container.

## Run With Docker Compose

From this folder:

```bash
docker compose up --build
```

Then open:

- Frontend: `http://localhost:8080`
- Backend health: `http://localhost:4000/health`
- MongoDB: `localhost:27018`

Seed users are created automatically:

- Admin: `admin@parking.com` / `Admin@123`
- User: `user@parking.com` / `User@123`

Razorpay order creation needs `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` environment variables. The simulated payment endpoint still works without Razorpay credentials.
