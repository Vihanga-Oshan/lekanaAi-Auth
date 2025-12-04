// src/routes/auth.js
const express = require("express");
const axios = require("axios");
const { requiresAuth } = require("express-openid-connect");

const router = express.Router();

/**
 * POST /auth/resend-verification
 * Requires Auth0 session
 */
router.post("/resend-verification", requiresAuth(), async (req, res) => {
  try {
    const user = req.oidc.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "NOT_AUTHENTICATED",
        message: "You must be logged in to resend verification email."
      });
    }

    if (user.email_verified) {
      return res.status(400).json({
        success: false,
        message: "Email already verified."
      });
    }

    // MANAGEMENT API TOKEN
    const tokenResp = await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/oauth/token`,
      {
        client_id: process.env.AUTH0_MGMT_CLIENT_ID,
        client_secret: process.env.AUTH0_MGMT_CLIENT_SECRET,
        audience: `https://${process.env.AUTH0_DOMAIN}/api/v2/`,
        grant_type: "client_credentials"
      }
    );

    const mgmtToken = tokenResp.data.access_token;

    // SEND VERIFICATION EMAIL
    await axios.post(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/jobs/verification-email`,
      {
        user_id: user.sub
      },
      {
        headers: {
          Authorization: `Bearer ${mgmtToken}`
        }
      }
    );

    res.json({
      success: true,
      message: "Verification email sent."
    });
  } catch (err) {
    console.error("Resend verification error:", err.response?.data || err);
    res.status(500).json({
      success: false,
      message: "Could not resend verification email."
    });
  }
});

module.exports = router;
