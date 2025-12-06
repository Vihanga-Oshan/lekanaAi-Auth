// src/server.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const { auth, requiresAuth } = require("express-openid-connect");

const onboardingRoutes = require("./routes/onboarding");
const checkOnboarding = require("./middleware/checkOnboarding");
const authRoutes = require("./routes/auth");
const appRoutes = require("./routes/app");

// ---------------------------------------------
// CONFIG
// ---------------------------------------------

// Cloud Run injects PORT=8080 automatically
const PORT = process.env.PORT || 4000;

// Backend base URL
// Local: uses .env AUTH0_BASE_URL (http://localhost:4000)
// Cloud Run: uses env var you set in gcloud (https://service.run.app)
const BASE_URL =
  process.env.AUTH0_BASE_URL || `https://lekanaai-auth-533849219780.europe-west1.run.app`;

// Frontend URL (local or deployed)
const FRONTEND_URL =
  process.env.FRONTEND_URL || "https://lekanaai-auth-533849219780.europe-west1.run.app";

const app = express();

// ---------------------------------------------
// JSON + CORS
// ---------------------------------------------
app.use(express.json());
app.use(
  cors({
    origin: [FRONTEND_URL],
    credentials: true,
  })
);

// ---------------------------------------------
// AUTH0 CONFIG
// ---------------------------------------------
app.use(
  auth({
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,

    authorizationParams: {
      redirect_uri: `${BASE_URL}/callback`,
    },

    routes: {
      callback: "/callback",
      postLogoutRedirect: `${FRONTEND_URL}/`,
    },
  })
);

// ---------------------------------------------
// LOGIN
// ---------------------------------------------
app.get("/auth/login", (req, res) => {
  res.oidc.login({
    returnTo: "/auth/redirect-handler",
    authorizationParams: {
      redirect_uri: `${BASE_URL}/callback`,
    },
  });
});

// ---------------------------------------------
// REDIRECT HANDLER
// ---------------------------------------------
app.get("/auth/redirect-handler", (req, res) => {
  const user = req.oidc.user;

  if (!req.oidc.isAuthenticated() || !user) {
    return res.redirect(`${FRONTEND_URL}/login-error`);
  }

  if (!user.email_verified) {
    return res.redirect(`${FRONTEND_URL}/verify-email`);
  }

  return res.redirect(`${FRONTEND_URL}/getting-started`);
});

// ---------------------------------------------
// LOGOUT
// ---------------------------------------------
app.get("/auth/logout", (req, res) => {
  const returnTo = req.query.returnTo || `${FRONTEND_URL}/`;
  res.oidc.logout({ returnTo });
});

// ---------------------------------------------
// AUTH ROUTES
// ---------------------------------------------
app.use("/auth", authRoutes);

// Debug – who am I
app.get("/api/me", requiresAuth(), (req, res) => {
  res.json({
    authenticated: req.oidc.isAuthenticated(),
    user: req.oidc.user,
  });
});

// ---------------------------------------------
// PROTECTED BUSINESS ROUTES
// ---------------------------------------------
app.use("/api/onboarding", requiresAuth(), onboardingRoutes);
app.use("/api/app", requiresAuth(), checkOnboarding, appRoutes);

// Root check
app.get("/", (req, res) => res.send("Auth service running..."));

// ---------------------------------------------
// START SERVER
// ---------------------------------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port " + PORT);
});
