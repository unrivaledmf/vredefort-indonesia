import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import apiRouter from './server/api.ts';
import { initDatabase } from './server/db.ts';

const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

// In-Memory Rate Limiter Helper (Tahap C6)
interface RateLimitBucket {
  count: number;
  resetAt: number;
}

function createRateLimiter(maxRequests: number, windowMs: number, errorMessage: string) {
  const buckets = new Map<string, RateLimitBucket>();

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [ip, b] of buckets.entries()) {
      if (b.resetAt <= now) buckets.delete(ip);
    }
  }, 60000).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const bucket = buckets.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (bucket.count >= maxRequests) {
      return res.status(429).json({
        error: errorMessage,
        retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000)
      });
    }

    bucket.count++;
    next();
  };
}

async function startServer() {
  const app = express();

  // Trust proxy for accurate client IP behind reverse proxy / AI Studio (Tahap C6)
  app.set('trust proxy', 1);

  // Initialize DB, schema migration, and ensure directories
  initDatabase();

  // Compression middleware (Tahap D2)
  app.use(compression());

  // 1. Security Headers & CSP (Tahap C5)
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    if (isProduction) {
      // Production CSP without 'unsafe-eval', includes object-src and frame-ancestors for PDF previews
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; object-src 'self'; frame-ancestors 'self';"
      );
    } else {
      // Development CSP: accommodates Vite HMR and dynamic evaluation
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self' ws: wss:; object-src 'self'; frame-ancestors 'self';"
      );
    }
    next();
  });

  // 2. Concise Request Logger Middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      // Filter out vite HMR polling noise in dev
      if (!req.path.startsWith('/@') && !req.path.startsWith('/node_modules')) {
        console.log(`[HTTP] ${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
      }
    });
    next();
  });

  // 3. Rate Limiters (Tahap C6)
  const apiLimiter = createRateLimiter(300, 60 * 1000, 'Terlalu banyak permintaan API. Harap tunggu beberapa saat.');
  const uploadLimiter = createRateLimiter(20, 60 * 1000, 'Batas frekuensi unggah berkas terlampaui. Harap tunggu 1 menit.');

  app.use('/api', apiLimiter);
  app.use('/api/files/upload', uploadLimiter);

  // 4. Body Parsing Middleware (Tahap C8)
  // Higher limit for workspace logo upload route specifically
  app.use('/api/workspace/logo', express.json({ limit: '5mb' }));
  app.use('/api/workspace-logo', express.json({ limit: '5mb' }));

  // Global body parser with 1mb limit
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // 5. Mount API Endpoints
  app.use('/api', apiRouter);

  // Serve static assets in public directory (logo.png, logo.svg, etc.)
  app.use(express.static(path.resolve(process.cwd(), 'public')));

  // Catch-all 404 handler for unmatched /api routes so they NEVER fall through to Vite HTML
  app.all('/api/*', (_req: Request, res: Response) => {
    return res.status(404).json({ error: 'Endpoint API tidak ditemukan.' });
  });

  // 6. Global Error Handling Middleware (no stack traces leaked to client)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[SERVER ERROR]:', err);
    return res.status(err.status || 500).json({
      error: err.message && isProduction ? 'Terjadi kesalahan internal pada server' : (err.message || 'Terjadi kesalahan internal')
    });
  });

  // 7. Vite middleware in dev or optimized static files in production (Tahap D2)
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');

    // Immutable caching for hashed assets in dist/assets
    app.use(
      '/assets',
      express.static(path.join(distPath, 'assets'), {
        maxAge: '1y',
        immutable: true
      })
    );

    // Standard static serving for other files
    app.use(express.static(distPath));

    // SPA fallback with no-cache for index.html
    app.get('*', (_req, res) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[VREDEFORT INDONESIA] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
