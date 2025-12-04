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

const app = express();

// --------------------------------------------------
// JSON + CORS
// --------------------------------------------------
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true
  })
);

// --------------------------------------------------
// AUTH0 CONFIG WITH CUSTOM CALLBACK
// --------------------------------------------------
app.use(
  auth({
    authRequired: false,
    auth0Logout: true,
    secret: process.env.AUTH0_SECRET,
    baseURL: process.env.AUTH0_BASE_URL,
    clientID: process.env.AUTH0_CLIENT_ID,
    issuerBaseURL: process.env.AUTH0_ISSUER_BASE_URL,

    authorizationParams: {
      redirect_uri: "http://localhost:4000/callback"
    },

    routes: {
      callback: "/callback",
      postLogoutRedirect: "http://localhost:5173/"
    }
  })
);

// --------------------------------------------------
// LOGIN ROUTE - REDIRECT TO CUSTOM HANDLER AFTER LOGIN
// --------------------------------------------------
app.get("/auth/login", (req, res) => {
  res.oidc.login({
    returnTo: "/auth/redirect-handler",
    authorizationParams: {
      redirect_uri: "http://localhost:4000/callback"
    }
  });
});

// --------------------------------------------------
// CUSTOM REDIRECT HANDLER - CHECKS EMAIL VERIFICATION
// --------------------------------------------------
app.get("/auth/redirect-handler", (req, res) => {
  console.log("=== Redirect handler triggered ===");
  console.log("Authenticated:", req.oidc.isAuthenticated());
  
  if (!req.oidc.isAuthenticated()) {
    console.log("Not authenticated, redirecting to login-error");
    return res.redirect("http://localhost:5173/login-error");
  }

  const user = req.oidc.user;
  console.log("User:", user);
  console.log("Email verified:", user?.email_verified);

  if (!user) {
    console.log("No user, redirecting to login-error");
    return res.redirect("http://localhost:5173/login-error");
  }

  if (!user.email_verified) {
    console.log("Email not verified, redirecting to verify-email");
    return res.redirect("http://localhost:5173/verify-email");
  }

  console.log("Email verified, redirecting to onboarding");
  return res.redirect("http://localhost:5173/onboarding");
});

// --------------------------------------------------
// LOGOUT ROUTE
// --------------------------------------------------
app.get("/auth/logout", (req, res) => {
  const returnTo = req.query.returnTo || "http://localhost:5173/";
  res.oidc.logout({ returnTo });
});

// --------------------------------------------------
// AUTH ROUTES (e.g. resend verification)
// --------------------------------------------------
app.use("/auth", authRoutes);

// --------------------------------------------------
// DEBUG: VIEW AUTH USER
// --------------------------------------------------
app.get("/api/me", requiresAuth(), (req, res) => {
  res.json({
    authenticated: req.oidc.isAuthenticated(),
    user: req.oidc.user
  });
});

// --------------------------------------------------
// PROTECTED API ROUTES
// --------------------------------------------------
app.use("/api/onboarding", requiresAuth(), onboardingRoutes);
app.use("/api/app", requiresAuth(), checkOnboarding, appRoutes);

// --------------------------------------------------
app.get("/", (req, res) => res.send("Auth service running…"));
// --------------------------------------------------

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log("Server running on 4000");
});
