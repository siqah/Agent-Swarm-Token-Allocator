import rateLimit from 'express-rate-limit';

function createOpts(max) {
  return {
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { message: 'Too many requests. Try again in a moment.', type: 'rate_limit_error', code: 'rate_limited' }
    },
  };
}

export const apiLimiter = rateLimit(createOpts(120));
export const controlPlaneLimiter = rateLimit({
  ...createOpts(30),
  message: {
    error: { message: 'Too many requests. Try again in a moment.', type: 'rate_limit_error', code: 'rate_limited' }
  },
});
