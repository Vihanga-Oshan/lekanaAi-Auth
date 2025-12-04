# Auth Service

A Node.js authentication service built with Express and Auth0, featuring email verification and user onboarding workflows.

## Features

- **Auth0 Integration** - OpenID Connect authentication with Auth0
- **Email Verification** - Unverified users redirected to verification page
- **User Onboarding** - Custom redirect flow based on authentication status
- **JWT Protected Routes** - Secure API endpoints with authentication middleware
- **Email Resend** - Ability to resend verification emails via Auth0 Management API
- **PostgreSQL Database** - User data persistence with Neon database

## Prerequisites

- Node.js 18+ (or Docker)
- Auth0 account with configured application
- PostgreSQL database (Neon or similar)
- npm or yarn

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server
PORT=4000

# Auth0 (Login + Sessions)
AUTH0_SECRET=your_auth0_secret
AUTH0_BASE_URL=http://localhost:4000
AUTH0_ISSUER_BASE_URL=https://your-domain.us.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret

# Auth0 (Management API)
AUTH0_MGMT_CLIENT_ID=your_mgmt_client_id
AUTH0_MGMT_CLIENT_SECRET=your_mgmt_client_secret
AUTH0_DOMAIN=your-domain.us.auth0.com

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@host:port/database
```

## Installation

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The server will start on `http://localhost:4000`

### Docker

```bash
# Build Docker image
docker build -t auth-service:latest .

# Run with docker-compose
docker-compose up -d
```

Or run directly:

```bash
docker run -p 4000:4000 \
  -e AUTH0_SECRET=your_secret \
  -e AUTH0_CLIENT_ID=your_client_id \
  -e AUTH0_CLIENT_SECRET=your_client_secret \
  auth-service:latest
```

## API Endpoints

### Authentication Routes

#### `GET /auth/login`

Initiates the Auth0 login flow. Redirects to Auth0 login page.

**Query Parameters:**

- `returnTo` (optional) - URL to redirect to after login (default: `/auth/redirect-handler`)

**Example:**

```
GET http://localhost:4000/auth/login?returnTo=http://localhost:5173/dashboard
```

**Response:** Redirects to Auth0 login page

---

#### `GET /callback`

Auth0 callback endpoint. Handles the OAuth callback after user logs in.

**Response:** Redirects to `/auth/redirect-handler` after processing

---

#### `GET /auth/redirect-handler`

Custom redirect handler that checks email verification status and redirects accordingly.

**Redirect Logic:**

- ❌ Not authenticated → `http://localhost:5173/login-error`
- ❌ No user data → `http://localhost:5173/login-error`
- ❌ Email not verified → `http://localhost:5173/verify-email`
- ✅ Email verified → `http://localhost:5173/onboarding`

**Response:** Redirect to appropriate URL based on user status

---

#### `GET /auth/logout`

Logs out the current user and clears the session.

**Query Parameters:**

- `returnTo` (optional) - URL to redirect to after logout (default: `http://localhost:5173/`)

**Example:**

```
GET http://localhost:4000/auth/logout?returnTo=http://localhost:5173/goodbye
```

**Response:** Clears session and redirects to specified URL

---

#### `POST /auth/resend-verification`

Resends the email verification email to the authenticated user.

**Headers:**

```
Content-Type: application/json
```

**Authentication:** Requires valid session

**Response:**

```json
{
  "success": true,
  "message": "Verification email sent."
}
```

**Error Response (already verified):**

```json
{
  "success": false,
  "message": "Email already verified."
}
```

**Error Response (not authenticated):**

```json
{
  "success": false,
  "error": "NOT_AUTHENTICATED",
  "message": "You must be logged in to resend verification email."
}
```

---

### User Routes

#### `GET /api/me`

Gets the current authenticated user's profile information.

**Authentication:** Required (uses `requiresAuth` middleware)

**Response:**

```json
{
  "authenticated": true,
  "user": {
    "sub": "auth0|user_id",
    "email": "user@example.com",
    "email_verified": true,
    "name": "John Doe",
    "picture": "https://..."
  }
}
```

---

### Onboarding Routes

#### `GET /api/onboarding/*`

Onboarding-related endpoints.

**Authentication:** Required
**Additional Middleware:** Checks onboarding status

**Note:** See `src/routes/onboarding.js` for specific endpoints

---

### Application Routes

#### `GET /api/app/*`

Application-specific routes.

**Authentication:** Required
**Additional Middleware:** Checks onboarding completion

**Note:** See `src/routes/app.js` for specific endpoints

---

### Health Check

#### `GET /`

Health check endpoint to verify service is running.

**Response:**

```
Auth service running…
```

---

## Middleware

### `requiresAuth()`

Express middleware that requires user to be authenticated. Returns 401 if not authenticated.

### `checkOnboarding`

Custom middleware that verifies user has completed onboarding before accessing app routes.

---

## Authentication Flow

```
1. User visits frontend → clicks "Login"
2. Frontend redirects to → GET /auth/login
3. Server initiates Auth0 login flow
4. User authenticates with Auth0
5. Auth0 redirects to → GET /callback
6. Server processes OAuth callback
7. Redirects to → GET /auth/redirect-handler
8. Handler checks email_verified status
   - ✅ Email verified → Redirect to http://localhost:5173/onboarding
   - ❌ Email not verified → Redirect to http://localhost:5173/verify-email
   - ❌ No user → Redirect to http://localhost:5173/login-error
9. User completes onboarding
10. User can access protected routes
```

---

## Database Schema

The service expects a PostgreSQL database with at least one table for user onboarding status:

```sql
CREATE TABLE user_onboarding (
  user_id VARCHAR(255) PRIMARY KEY,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Error Handling

The service includes error handling for:

- Missing authentication
- Invalid Auth0 credentials
- Database connection failures
- Email verification failures
- Missing environment variables

All errors are logged to the console with descriptive messages.

---

## Development

### Project Structure

```
src/
├── server.js              # Main application file
├── db.js                  # Database connection
├── controllers/
│   ├── onboardingController.js
│   └── userController.js
├── middleware/
│   ├── checkOnboarding.js
│   └── requireAuth.js
└── routes/
    ├── app.js
    ├── auth.js
    ├── onboarding.js
    └── userRoutes.js
```

### Available Scripts

```bash
# Start development server with hot reload
npm run dev

# Start production server
npm start

# Run tests (if configured)
npm test
```

---

## Deployment

### Docker Deployment

1. Build the image:

```bash
docker build -t auth-service:latest .
```

2. Push to registry (optional):

```bash
docker tag auth-service:latest your-registry/auth-service:latest
docker push your-registry/auth-service:latest
```

3. Run with docker-compose:

```bash
docker-compose up -d
```

### Auth0 Configuration for Production

Update the following in your Auth0 application settings:

**Allowed Callback URLs:**

```
https://yourdomain.com/callback
```

**Allowed Logout URLs:**

```
https://yourdomain.com
```

**Allowed Web Origins:**

```
https://yourdomain.com
```

---

## Troubleshooting

### "Using 'form_post' for response_mode may cause issues..."

This warning appears when using HTTP in development. It's normal and won't affect functionality. Use HTTPS in production.

### User redirects to login-error

- Check that `req.oidc.user` is properly populated
- Verify Auth0 configuration in `.env`
- Check Auth0 Dashboard callback URL settings

### Email verification not working

- Ensure Auth0 Management API credentials are correct
- Check that email templates are configured in Auth0
- Verify user email in Auth0 dashboard

### Database connection issues

- Verify `DATABASE_URL` format
- Check network connectivity to database host
- Ensure database credentials are correct

---

## License

MIT

---

## Support

For issues or questions, please refer to:

- [Auth0 Documentation](https://auth0.com/docs)
- [Express.js Documentation](https://expressjs.com/)
- [Node.js Documentation](https://nodejs.org/docs/)
#   l e k a n a A i - A u t h  
 