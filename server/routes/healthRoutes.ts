import { Router } from 'express';
import { checkDbHealth } from '../db/pool';

const router = Router();

router.get('/health', async (req, res) => {
  const dbHealth = await checkDbHealth();

  const isHealthy = dbHealth.connected;

  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'ok' : 'degraded',
    database: {
      connected: dbHealth.connected,
      type: dbHealth.type,
      latencyMs: dbHealth.latencyMs,
      error: dbHealth.error,
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export default router;
