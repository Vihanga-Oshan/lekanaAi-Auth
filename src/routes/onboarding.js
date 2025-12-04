const express = require("express");
const { requiresAuth } = require("express-openid-connect");

const {
  saveOnboarding,
  getOnboarding
} = require("../controllers/onboardingController");

const router = express.Router();

function checkEmailVerified(req, res, next) {
  if (!req.oidc?.user?.email_verified) {
    return res.status(403).json({
      success: false,
      error: "EMAIL_NOT_VERIFIED",
      message: "Please verify your email before continuing."
    });
  }
  next();
}

router.post("/save", requiresAuth(), checkEmailVerified, saveOnboarding);
router.get("/me", requiresAuth(), checkEmailVerified, getOnboarding);


module.exports = router;
