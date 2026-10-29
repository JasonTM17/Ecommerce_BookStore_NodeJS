import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { config } from '../../config/configuration';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * In-memory fixed-window rate limiter matching the Spring RateLimitingFilter
 * tiers: auth endpoints get the strictest limit, anonymous/public traffic the
 * loosest, and authenticated API calls sit in between.
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = Date.now();

  use(req: Request, res: Response, next: NextFunction): void {
    const limits = config.rateLimit;
    if (!limits.enabled) return next();

    const now = Date.now();
    if (now - this.lastSweep > 60000) {
      this.lastSweep = now;
      for (const [key, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(key);
      }
    }

    const path = req.path.toLowerCase();
    const isAuthEndpoint =
      path.endsWith('/auth/login') ||
      path.endsWith('/auth/register') ||
      path.endsWith('/auth/forgot-password') ||
      path.endsWith('/auth/reset-password');
    const hasAuthHeader = !!req.headers['authorization'];

    let limit: number;
    let windowMs: number;
    if (isAuthEndpoint) {
      limit = limits.authLimit;
      windowMs = limits.authWindowMs;
    } else if (hasAuthHeader) {
      limit = limits.apiLimit;
      windowMs = limits.apiWindowMs;
    } else {
      limit = limits.publicLimit;
      windowMs = limits.publicWindowMs;
    }

    const key = `${this.clientIp(req)}:${isAuthEndpoint ? 'auth' : hasAuthHeader ? 'api' : 'pub'}`;
    const bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + windowMs });
      this.setHeaders(res, limit, limit - 1, now + windowMs);
      return next();
    }

    bucket.count += 1;
    const remaining = Math.max(0, limit - bucket.count);
    this.setHeaders(res, limit, remaining, bucket.resetAt);

    if (bucket.count > limit) {
      res.status(429).json({
        timestamp: new Date().toISOString(),
        status: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        path: req.originalUrl,
      });
      return;
    }
    next();
  }

  private clientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }

  private setHeaders(res: Response, limit: number, remaining: number, resetAt: number): void {
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
  }
}
