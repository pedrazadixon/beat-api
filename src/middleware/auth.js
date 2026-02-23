/**
 * Bearer Token Authentication Middleware
 * Validates the Authorization header against the configured BEARER_TOKEN.
 */

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Missing Authorization header',
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return res.status(401).json({
      success: false,
      error: 'Invalid Authorization format. Use: Bearer <token>',
    });
  }

  const token = parts[1];
  const expectedToken = process.env.BEARER_TOKEN;

  if (!expectedToken) {
    console.error('[AUTH] BEARER_TOKEN not configured in .env');
    return res.status(500).json({
      success: false,
      error: 'Server authentication not configured',
    });
  }

  if (token !== expectedToken) {
    return res.status(403).json({
      success: false,
      error: 'Invalid token',
    });
  }

  next();
}

module.exports = authMiddleware;
