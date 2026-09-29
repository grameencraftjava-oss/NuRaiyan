import express from 'express';
import http from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { ENV } from './config/env';
import apiRoutes from './routes/api.routes';
import { apiLimiter } from './middleware/rateLimiter';
import { setupSocketIO } from './sockets/socketHandler';
import { prisma } from './lib/prisma';
import {
  sanitizeInputMiddleware,
  csrfOriginGuard,
  securityHeadersMiddleware,
  isAllowedOrigin,
} from './middleware/security.middleware';

// ── 1. Process-Level Anti-Crash Handlers ─────────────────────────
process.on('uncaughtException', (err: Error) => {
  console.error('[CRITICAL] Uncaught Exception:', err.name, err.message);
  // Log safely without halting process abruptly
});

process.on('unhandledRejection', (reason: any) => {
  console.error('[CRITICAL] Unhandled Rejection:', reason);
});

const app = express();
const server = http.createServer(app);

// Generous timeouts to support ultra-large 4K video uploads and file transfers (10 minutes)
server.timeout = 10 * 60 * 1000;
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 10 * 60 * 1000;

// ── 2. Information Disclosure Prevention & Cache Prevention ────────
app.disable('x-powered-by');
app.disable('etag');

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ── 3. WebSocket Real-Time Server ────────────────────────────────
const io = new SocketIOServer(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation'));
      }
    },
    credentials: true,
  },
  maxHttpBufferSize: 5e6, // 5MB buffer limit to prevent memory exhaustion DoS
});
setupSocketIO(io);
app.set('io', io);

// ── CORS (Must be applied before routes and static assets) ───────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or server-to-server)
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation: Unauthorized origin'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Range', 'x-access-token'],
    exposedHeaders: ['x-access-token', 'Content-Range', 'Accept-Ranges'],
    maxAge: 86400, // Preflight cache for 24h
  })
);

// ── Security Headers (Helmet with cross-origin media support) ────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false,
  })
);

// ── Static Permanent Uploads Serving (CORS & Range Support) ──────
app.use(
  '/uploads',
  (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Accept-Ranges', 'bytes');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  },
  express.static(path.join(process.cwd(), 'uploads'))
);


app.use(cookieParser());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// 🛡️ Malformed Payload Shield: Prevent server crash on corrupted JSON input
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload rejected.',
    });
  }
  next(err);
});

// Custom Security Guards
app.use(securityHeadersMiddleware);
app.use(csrfOriginGuard);
app.use(sanitizeInputMiddleware);

if (ENV.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ── 5. Rate Limiter on all API routes ────────────────────────────
app.use('/api', apiLimiter);

// ── 6. Application API Endpoints ─────────────────────────────────
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    system: 'Nuraiyan Core API',
    security: 'Argon2id + JWT + Helmet + Sanitize Active',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  });
});

// ── 7. Fallback 404 Handler ──────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Requested resource not found.',
  });
});

// ── 8. Hardened Global Error Handler (Zero Data Leakage) ─────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Log full error internally for debugging
  console.error('[Internal Error Audit]', {
    path: req.originalUrl,
    method: req.method,
    ip: req.ip,
    error: err.message,
  });

  // Never leak internal SQL, schema, or system details to external clients
  const statusCode = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  res.status(statusCode).json({
    success: false,
    message:
      statusCode === 500
        ? 'Internal server error occurred.'
        : err.message || 'The request could not be processed.',
  });
});

// ── 9. Graceful Server Start & Shutdown ──────────────────────────
const requestedPort = Number(ENV.PORT) || 5001;

const startServer = (port: number) => {
  const srv = server.listen(port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Nuraiyan Social Network API running on port ${port}`);
    console.log(`🔒 Security: Helmet, Argon2id, CSRF, Anti-XSS & Anti-DoS`);
    console.log(`⚡ Real-Time Engine: WebSockets & WebRTC Active`);
    console.log(`=======================================================`);
  });

  srv.once('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[WARN] Port ${port} is in use (e.g. macOS AirPlay Receiver). Retrying on port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('[CRITICAL] Server listen error:', err);
    }
  });
};

startServer(requestedPort);

const gracefulShutdown = async (signal: string) => {
  console.log(`${signal} received. Closing connections gracefully...`);
  setTimeout(() => process.exit(0), 800);
  try {
    io.close();
    server.close(() => {
      process.exit(0);
    });
  } catch {
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
