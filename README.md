# Torque Titan Spare Parts

## Project Overview

Torque Titan Spare Parts is an e-commerce platform designed to sell automobiles spareparts online. This website enables the store to efficiently receive orders from buyers and subsequently deliver them as soon as possible.


## Tech Stack

### Backend
- **Python (Django)** – The backend uses Django, a robust Python web framework
- **PostgreSQL** – Relational database
- **Celery** – Handles background tasks, specifically sending emails using Redis as the message broker
- **Google OAuth** – Provides Continue with Google authentication
- **Cloudflare R2** – Handles storage of spare-part image files uploaded by admins
- **Stripe** – Credit/debit card payment processing integration
- **Paystack** – Mobile Money payment processing via M-Pesa and Airtel Money
- **PayPal** – Payment processing integration

### Frontend
- **React + TypeScript** – Used to build the application's user interface
- **createContext / useContext** – React APIs used for application state management
- **React Router** – Navigation and client-side routing
- **Fetch API** – HTTP client for making API requests
- **Tailwind CSS** – Utility-first CSS framework for responsive styling

### Testing
- **Vitest** – Frontend unit testing
- **Pytest** – Backend testing

---

## Features

### Buyer Capabilities
- Authentication (Register/Login),including GoogleOAuth
- Changing password(including after forgetting password) and deleting acccount
- Filter the available spareparts by the dropdown options
- Use the smart search bar to filter spareparts by brand and automobile type
- Add desired spareparts to cart
- Checkout and pay for selected animals via credit card,mobile money and paypal
- Cancel order before it is shipped
- View and track order history
- View and track own reviews history
- Give a star rating and write a comment on each sparepart
- Like or dislike other buyers comments using a thumbs up or down icons

### Admin Capabilities
- Authentication (Register/Login),including GoogleOAuth
- Changing password(including after forgetting password) and deleting account
- Superadmin can create new admins and remove existing ones
- Add new spareparts to the database for sale
- Edit or delete existing spareparts in the database
- View incoming orders from buyers
- Mark orders as shipped then ultimately delivered
- View all star ratings and reviews from buyers,along with the reactions on the comments
- View Star Rating Analytics,with brand ranking based on star rating
- View Revenue Analytics,which includes daily,weekly,monthly and annual revenue generation

---

## Database Schema

The backend utilizes the following core models:

- **Users** – Contains all buyers and admins accounts
- **Spareparts** – Contains all data about the spareparts
- **Orders** – Contains all submitted orders data
- **OrderItems** – Connects spareparts to specific orders
- **Reviews** - Contains all star ratings and comments data from buyers
- **ReviewReactions** - Contains likes or dislikes on each comment

---

## API Endpoints

### Authentication

- `POST /register/` — Register a new user and receive an OTP for verification
- `POST /verify-account/` — Verify received OTP
- `POST /resend-otp/` — Request a new OTP
- `POST /login/` — Login and receive JWT tokens
- `POST /auth/google/` — Login/register using Google OAuth
- `POST /forgot-password/` — Request OTP for password reset
- `POST /change-password/` — Change an existing password
- `POST /delete-account/` — Delete the existing account
- `POST /token/refresh/` — Refresh the access token
- `POST /logout/` — Logout and invalidate the refresh token

### Spare Parts

- `GET /spareparts/` — List spare parts, supporting filters
- `GET /spareparts/<string:part_id>/` — View details of a specific spare part

### Reviews

- `POST /reviews/<string:part_id>/` — Post a rating and/or comment
- `POST /reviews/<string:review_id>/edit/` — Edit an existing review
- `DELETE /reviews/<string:review_id>/delete/` — Delete an existing review
- `POST /reviews/<string:review_id>/react/` — Like or dislike a review
- `GET /buyer-reviews/` — Fetch the authenticated buyer's reviews

### Orders

- `GET /orders/` — View buyer orders
- `POST /orders/` — Place a new order
- `PATCH /orders/<string:order_id>/` — Update/cancel a buyer order

### Admin Account Management

- `POST /admin/create-admin/` — Superadmin creates a new admin
- `GET /admin/admins/` — Fetch all existing admins
- `DELETE /admin/delete-admin/<string:admin_id>/` — Delete an individual admin

### Admin Spare Parts

- `POST /admin/spareparts/` — Add a new spare part
- `PATCH /admin/spareparts/<string:spare_id>/` — Edit a spare-part listing
- `DELETE /admin/spareparts/<string:spare_id>/` — Delete a spare-part listing

### Admin Reviews

- `GET /admin/reviews/` — Fetch all buyer ratings and comments
- `GET /admin/reviews/sparepart/<string:sparepart_id>/` — Fetch ratings and comments for an individual spare part
- `GET /admin/reviews-analytics/` — Fetch review analytics

### Admin Orders

- `GET /admin/orders/` — Fetch all orders
- `PATCH /admin/orders/<string:order_id>/` — Update an order's status

### Stripe Checkout

- `POST /checkout/create-stripe-session/` — Create a Stripe Checkout session
- `POST /checkout/stripe-cancel/` — Handle a cancelled Stripe Checkout session
- `POST /webhook/stripe/` — Handle Stripe webhook events

### Paystack Checkout

- `POST /checkout/create-paystack-session/` — Create a Paystack payment session
- `GET /checkout/verify-paystack-session/<string:reference>/` — Verify a Paystack transaction
- `POST /webhook/paystack/` — Handle Paystack webhook events

### PayPal Checkout

- `POST /checkout/create-paypal-session/` — Create a PayPal order/session
- `POST /checkout/paypal-capture/` — Capture an approved PayPal payment
- `POST /checkout/paypal-cancel/` — Handle a cancelled PayPal payment
- `POST /webhook/paypal/` — Handle PayPal webhook events

### Data Analytics

- `GET /admin/revenue-analytics/` — Fetch revenue analytics
- `GET /admin/reviews-analytics/` — Fetch review analytics

---

## Environment Variables

- FRONTEND_ENDPOINT_URL=[frontend-url]
- CORS_ALLOWED_ORIGINS=[allowed-frontend-origins]
- CSRF_TRUSTED_ORIGINS=[trusted-frontend-origins]
- SECRET_KEY=[django-secret-key]
- DEBUG=[true-or-false]
- ALLOWED_HOSTS=[allowed-hosts]
- JWT_SECRET_KEY=[jwt-secret-key]
- REFRESH_COOKIE_NAME=[refresh-cookie-name]
- REFRESH_COOKIE_MAX_AGE=[refresh-cookie-max-age]
- REFRESH_COOKIE_SECURE=[true-or-false]
- REFRESH_COOKIE_SAMESITE=[samesite-policy]
- GOOGLE_CLIENT_ID=[google-client-id]
- GOOGLE_CLIENT_SECRET=[google-client-secret]
- STRIPE_SECRET_KEY=[stripe-secret-key]
- STRIPE_WEBHOOK_SECRET=[stripe-webhook-secret]
- STRIPE_SUCCESS_URL=[stripe-success-url]
- STRIPE_CANCEL_URL=[stripe-cancel-url]
- PAYSTACK_SECRET_KEY=[paystack-secret-key]
- PAYPAL_CLIENT_ID=[paypal-client-id]
- PAYPAL_CLIENT_SECRET=[paypal-client-secret]
- PAYPAL_ENVIRONMENT=[paypal-environment]
- PAYPAL_CURRENCY=[paypal-currency]
- PAYPAL_WEBHOOK_ID=[paypal-webhook-id]
- SUPER_ADMIN_EMAIL=[super-admin-email]
- SUPER_ADMIN_PASSWORD=[super-admin-password]
- USER_EMAIL=[default-buyer-email]
- USER_PASSWORD=[default-buyer-password]
- DATABASE_URL=[database-url]
- R2_ACCESS_KEY_ID=[r2-access-key-id]
- R2_SECRET_ACCESS_KEY=[r2-secret-access-key]
- R2_BUCKET_NAME=[r2-bucket-name]
- R2_ENDPOINT_URL=[r2-endpoint-url]
- R2_PUBLIC_URL=[r2-public-url]
- CELERY_BROKER_URL=[redis-broker-url]
- CELERY_RESULT_BACKEND=[redis-result-backend-url]
- BREVO_API_KEY=[brevo-api-key]

---

## Getting Started

### Prerequisites
- Python 3.8+
- Node.js 14+
- PostgreSQL

---

## Backend Setup

1. Clone the repository:
```bash
git clone git@github.com:Visionnaire1000/Torque-Titan-Spare-Parts-001.git
cd backend inside the directory,Torque-Titan-Spare-Parts-001
```

2. Create and activate a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```
4. Set up environment variables

5. Run the migrations
```bash
python manage.py migrate
```

6. Seed the database:
```bash
python manage.py devSeed
```
7. Start Redis Server
```bash
redis-server
```

8. Run the development server:
```bash
python manage.py runserver
```

9. Run the Celery worker inside a virtual environment:
```bash
celery -A utils.celery_worker worker --loglevel=info
```

10. For local Stripe Payment testing run stripe CLI inside a virtual environment
```bash
stripe listen --forward-to localhost:8000/webhook/stripe/
```
11. For local Paypal and Paystack(mobile money) Payment testing run ngrok at a root directory
```bash
ngrok http 8000
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

## User Workflows
### Buyer Workflow
1. Register/Login
2. Browse and search listings by type,brand,colour,price
3. Add spareparts to cart
4. Checkout and make payments
5. Track orders
6. Optionally give star ratings and leave comments

### Admin Workflow
1. Register/Login
2. Add spareparts to inventory,edit and delete them when necessary
3. View and manage orders,marking them as shipped or delivered
4. View reviews and reviews analytics on spareparts and reach out to buyers whenever necessary
5. View Revenue Analytics
6. For Superadmins,create more admins or delete existing ones whenever necessary


## Deployment

The application is configured for deployment using Render


## License


This project is licensed under the MIT License.


---
