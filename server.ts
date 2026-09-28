import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ServerSyncService } from './src/server/syncService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  app.post('/api/sync/push', async (req, res) => {
    try {
      const response = await ServerSyncService.processPush(req.body);
      res.json(response);
    } catch (err: any) {
      console.error('Error in /api/sync/push:', err);
      res.status(400).json({ error: err.message || 'Push sync failed' });
    }
  });

  // Authoritative Trusted Server Sync Pull Endpoint
  app.post('/api/sync/pull', async (req, res) => {
    try {
      const response = await ServerSyncService.processPull(req.body);
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

// Start server if this file is executed directly
if (process.env.NODE_ENV !== 'test') {
  createServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { createServer };
