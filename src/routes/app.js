const express = require("express");
const router = express.Router();

// A simple protected app route
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "You are onboarded and authenticated!",
    user: req.oidc.user
  });
});

module.exports = router;
