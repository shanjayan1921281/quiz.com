import http from 'http';
import path from 'path';
import express from 'express';
import { createApp } from './server/app';
import { initWsServer } from './server/websocket/wsServer';
import { runMigrations } from './server/db/pool';
import { AuthService } from './server/services/authService';
import { QuestionService } from './server/services/questionService';
import { EventService } from './server/services/eventService';
import { config } from './server/config';

async function startServer() {
  const app = createApp();
  const server = http.createServer(app);

  // Initialize WebSocket server on the same HTTP server (/ws)
  initWsServer(server);

  // 1. Run migrations if PostgreSQL is present
  await runMigrations();

  // 2. Initialize default admin & question seed
  await AuthService.initDefaultAdmin();
  await QuestionService.initSeedIfEmpty();

  // 3. Ensure a default active test event exists (PIN: 483921)
  const defaultEvent = await EventService.getEventByPin('483921');
  if (!defaultEvent) {
    await EventService.createEvent(
      'College Technical Championship 2026',
      30,
      200,
      true,
      '483921'
    );
    console.log('[Server] Initialized default event with PIN: 483921');
  }

  // 4. Vite middleware for development or static serving for production
  if (config.isProduction) {
    const distPath = path.resolve('dist');
    app.use(express.static(distPath));
    app.get('*', (req, res, next) => {
      // Don't intercept API or WS routes
      if (req.path.startsWith('/api') || req.path === '/health' || req.path.startsWith('/ws')) {
        return next();
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // In development, mount Vite middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = config.port;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`🚀 LiveQuiz Pro Server running on http://0.0.0.0:${PORT}`);
    console.log(`⚡ WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);
    console.log(`🩺 Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`🎮 Default Game PIN: 483921`);
    console.log(`==================================================\n`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
  process.exit(1);
});
