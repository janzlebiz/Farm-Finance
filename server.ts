import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ServerSyncService } from './src/server/syncService';
import { adminAuth } from './src/server/adminFirebase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface AuthenticatedRequest extends Request {
  userUid?: string;
}

/**
 * Express middleware to authenticate requests via Firebase ID Token
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token' });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (!decodedToken || !decodedToken.uid) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token claims' });
    }
    req.userUid = decodedToken.uid;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
  }
}

async function createServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Authoritative Trusted Server Sync Push Endpoint
  app.post('/api/sync/push', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userUid = req.userUid!;
      const changes = Array.isArray(req.body.changes) ? req.body.changes : [];
      const response = await ServerSyncService.processPush(userUid, changes);
      res.json(response);
    } catch (err: any) {
      console.error('Error in /api/sync/push:', err);
      res.status(400).json({ error: err.message || 'Push sync failed' });
    }
  });

  // Authoritative Trusted Server Sync Pull Endpoint
  app.post('/api/sync/pull', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userUid = req.userUid!;
      const sinceCursor = typeof req.body.sinceCursor === 'number' ? req.body.sinceCursor : 0;
      const response = await ServerSyncService.processPull(userUid, sinceCursor);
      res.json(response);
    } catch (err: any) {
      console.error('Error in /api/sync/pull:', err);
      res.status(400).json({ error: err.message || 'Pull sync failed' });
    }
  });

  if (!isProd) {
    // Development: integrate Vite dev server middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve built static assets
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Farm Finance Server] Running on port ${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

// Start server only when executed directly as entrypoint
const isMain = process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));
if (isMain && process.env.NODE_ENV !== 'test') {
  createServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { createServer };
