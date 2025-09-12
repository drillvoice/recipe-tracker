// Simple client-side rate limiting to prevent spam submissions

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs?: number;
}

interface RateLimitState {
  attempts: number[];
  blockedUntil?: number;
}

class RateLimiter {
  private limits = new Map<string, RateLimitState>();

  isAllowed(key: string, config: RateLimitConfig): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const state = this.limits.get(key) || { attempts: [] };

    // Check if currently blocked
    if (state.blockedUntil && now < state.blockedUntil) {
      return {
        allowed: false,
        retryAfter: Math.ceil((state.blockedUntil - now) / 1000)
      };
    }

    // Clean old attempts outside the window
    state.attempts = state.attempts.filter(time => now - time < config.windowMs);

    // Check if limit exceeded
    if (state.attempts.length >= config.maxAttempts) {
      const blockDuration = config.blockDurationMs || config.windowMs;
      state.blockedUntil = now + blockDuration;
      this.limits.set(key, state);
      
      return {
        allowed: false,
        retryAfter: Math.ceil(blockDuration / 1000)
      };
    }

    // Record this attempt
    state.attempts.push(now);
    this.limits.set(key, state);

    return { allowed: true };
  }

  reset(key: string): void {
    this.limits.delete(key);
  }

  // Clean up old entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, state] of this.limits.entries()) {
      const hasRecentAttempts = state.attempts.some((time: number) => now - time < 300000); // 5 minutes
      const isBlocked = state.blockedUntil && now < state.blockedUntil;
      
      if (!hasRecentAttempts && !isBlocked) {
        this.limits.delete(key);
      }
    }
  }
}

// Global rate limiter instance
const globalRateLimiter = new RateLimiter();

// Cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => globalRateLimiter.cleanup(), 300000);
}

// Predefined rate limit configurations
export const RATE_LIMITS = {
  FORM_SUBMISSION: {
    maxAttempts: 10,
    windowMs: 60000, // 1 minute
    blockDurationMs: 300000, // 5 minutes
  },
  AUTH_ATTEMPT: {
    maxAttempts: 5,
    windowMs: 300000, // 5 minutes
    blockDurationMs: 900000, // 15 minutes
  },
  PASSWORD_RESET: {
    maxAttempts: 3,
    windowMs: 600000, // 10 minutes
    blockDurationMs: 1800000, // 30 minutes
  },
} as const;

// Helper functions for common use cases
export function checkFormSubmissionLimit(userId?: string): { allowed: boolean; retryAfter?: number } {
  const key = `form_submission_${userId || 'anonymous'}`;
  return globalRateLimiter.isAllowed(key, RATE_LIMITS.FORM_SUBMISSION);
}

export function checkAuthAttemptLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const key = `auth_attempt_${identifier}`;
  return globalRateLimiter.isAllowed(key, RATE_LIMITS.AUTH_ATTEMPT);
}

export function checkPasswordResetLimit(email: string): { allowed: boolean; retryAfter?: number } {
  const key = `password_reset_${email}`;
  return globalRateLimiter.isAllowed(key, RATE_LIMITS.PASSWORD_RESET);
}

export function resetRateLimit(key: string): void {
  globalRateLimiter.reset(key);
}

export { globalRateLimiter };