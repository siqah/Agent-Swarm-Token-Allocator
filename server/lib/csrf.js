// CSRF protection using Origin header validation.
// Since all session-based routes use Authorization: Bearer headers
// (not cookies), the primary CSRF vector is eliminated. This middleware
// adds defense-in-depth by verifying the Origin header matches the
// expected value on state-changing requests.

const ALLOWED_ORIGINS = new Set();

export function configureCsrf(allowedOrigins) {
  for (const origin of allowedOrigins) {
    if (origin) ALLOWED_ORIGINS.add(origin);
  }
}

// For session-based state-changing routes
export function requireCsrf(req, res, next) {
  const method = req.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return next();

  const origin = req.headers['origin'];
  const referer = req.headers['referer'];

  // If no Origin header, allow (e.g., curl, server-to-server)
  if (!origin) return next();

  // Check Origin against allowed list
  for (const allowed of ALLOWED_ORIGINS) {
    if (origin === allowed || origin.startsWith(allowed)) return next();
  }

  // Fall back to Referer check
  if (referer) {
    for (const allowed of ALLOWED_ORIGINS) {
      if (referer.startsWith(allowed)) return next();
    }
  }

  return res.status(403).json({
    error: { message: 'CSRF validation failed. Origin not allowed.', type: 'invalid_request_error', code: 'csrf_error' }
  });
}
