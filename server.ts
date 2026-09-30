import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
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
    console.log('[AuthDebug] Missing or invalid authorization header:', authHeader);
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token' });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    console.log('[AuthDebug] Missing token after Bearer');
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authentication token' });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    if (!decodedToken || !decodedToken.uid) {
      console.log('[AuthDebug] Invalid token claims:', decodedToken);
      return res.status(401).json({ error: 'Unauthorized: Invalid token claims' });
    }
    req.userUid = decodedToken.uid;
    console.log('[AuthDebug] Successful auth for UID:', decodedToken.uid);
    next();
  } catch (err: any) {
    console.log('[AuthDebug] Token verification failed:', err.message);
    return res.status(401).json({ error: `Unauthorized: Invalid or expired token: ${err.message}` });
  }
}

async function createServer() {
  const app = express();
  // AI Studio requires port 3000. Force it to avoid EADDRINUSE on other ports like 8080.
  const PORT = 3000;
  const isProd = process.env.NODE_ENV === 'production';

  console.log(`[Farm Finance] Starting server in ${isProd ? 'production' : 'development'} mode on port ${PORT}`);

  // Secure and robust CORS handling for Android WebViews & trusted web origins
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const isAllowed = !origin || 
      origin === 'https://appassets.androidplatform.net' ||
      /^https:\/\/[a-z0-9-]+\.asia-east1\.run\.app$/.test(origin) ||
      /^https:\/\/[a-z0-9-]+\.run\.app$/.test(origin) ||
      /^http:\/\/localhost(:\d+)?$/.test(origin);

    if (isAllowed && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else if (!origin) {
      // For non-browser clients or direct API requests, we still want to allow common headers
      res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  app.use(express.json({ limit: '10mb' }));

  // Diagnostic: Auth Config
  app.get('/api/diagnostics/auth-config', (_req, res) => {
    res.json({
      projectId: adminApp.options.projectId,
      databaseId: 'ai-studio-farmfinance-93149cfe-1ff5-4e4b-a384-aa96984b5b0f',
      adminAuthInitialized: !!adminAuth,
      adminDbInitialized: !!adminDb
    });
  });

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
    const start = Date.now();
    const userUid = req.userUid!;
    const sinceCursor = typeof req.body.sinceCursor === 'number' ? req.body.sinceCursor : 0;
    
    console.log(`[PULL_DEBUG] request received uid=${userUid} sinceCursor=${sinceCursor}`);
    
    try {
      const response = await ServerSyncService.processPull(userUid, sinceCursor);
      const elapsed = Date.now() - start;
      const responseSize = JSON.stringify(response).length;
      
      console.log(`[PULL_DEBUG] response sent status=200 elapsed=${elapsed}ms size=${responseSize}bytes cursor=${response.currentServerCursor} bootstrap=${response.isBootstrap}`);
      res.json(response);
    } catch (err: any) {
      const elapsed = Date.now() - start;
      console.error(`[PULL_DEBUG] request failed status=400 elapsed=${elapsed}ms error=${err.message}`);
      if (err.stack) console.error(err.stack);
      res.status(400).json({ error: err.message || 'Pull sync failed' });
    }
  });

  // Authenticated Account Deletion & Cloud Purge Endpoint
  app.post('/api/auth/delete-account', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userUid = req.userUid!;
      // 1. Purge all user-owned Firestore data under /users/{uid}
      await ServerSyncService.purgeUserData(userUid);
      // 2. Delete Firebase Auth account only after cloud purge succeeds
      await adminAuth.deleteUser(userUid);
      res.json({ success: true, message: 'Account and cloud data successfully purged.' });
    } catch (err: any) {
      console.error('Error in /api/auth/delete-account:', err);
      res.status(400).json({ error: err.message || 'Account deletion and cloud purge failed' });
    }
  });

  if (!isProd) {
    // Development: integrate Vite dev server middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: 'custom'
    });
    app.use(vite.middlewares);

    // Fallback for HTML delivery in dev mode
    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        const indexPath = path.resolve(__dirname, 'index.html');
        let template = fs.readFileSync(indexPath, 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        
        // Strip the Vite client script in dev mode to prevent WebSocket connection errors [vite]
        // because HMR/WebSockets are often blocked in the AI Studio iframe environment.
        template = template.replace(/<script type="module" src="\/@vite\/client"><\/script>/, '');
        
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
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
