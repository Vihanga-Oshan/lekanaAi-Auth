const pool = require("../db");

module.exports = async function checkOnboarding(req, res, next) {
  try {
    if (!req.oidc || !req.oidc.user) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // 1. EMAIL VERIFICATION
    if (!req.oidc.user.email_verified) {
      return res.status(403).json({
        success: false,
        error: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email before accessing the app."
      });
    }

    const auth0_id = req.oidc.user.sub;

    const result = await pool.query(
      "SELECT onboarding_completed FROM users WHERE auth0_id = $1 LIMIT 1",
      [auth0_id]
    );

    if (result.rows.length === 0 || !result.rows[0].onboarding_completed) {
      return res.status(403).json({
        success: false,
        error: "ONBOARDING_REQUIRED",
        message: "User must complete onboarding"
      });
    }

    next();
  } catch (err) {
    console.error("checkOnboarding error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
