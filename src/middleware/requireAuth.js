module.exports = function requireAuth(req, res, next) {
  if (!req.oidc || !req.oidc.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
};
