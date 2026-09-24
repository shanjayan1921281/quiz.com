import express from 'express';
import cors from 'cors';
import { config } from './config';
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/authRoutes';
import eventRoutes from './routes/eventRoutes';
import questionRoutes from './routes/questionRoutes';
import { errorHandler } from './middleware/errorHandler';
import { runMigrations } from './db/pool';
import { AuthService } from './services/authService';
import { QuestionService } from './services/questionService';
import { EventService } from './services/eventService';

let initialized = false;
let initPromise: Promise<void> | null = null;

export async function ensureAppInitialized(): Promise<void> {
  if (initialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        await runMigrations();
        await AuthService.initDefaultAdmin();
        await QuestionService.initSeedIfEmpty();
        const defaultEvent = await EventService.getEventByPin('483921');
        if (!defaultEvent) {
          await EventService.createEvent(
            'College Technical Championship 2026',
            30,
            200,
            true,
            '483921'
          );
        }
      } catch (err) {
        console.warn('[App Init] Warning:', err);
      } finally {
        initialized = true;
      }
    })();
  }
  return initPromise;
}

export function createApp(): express.Application {
  const app = express();

  // CORS Configuration
  app.use(
    cors({
      origin: (origin, callback) => {
        // In development or if frontendUrl is '*', allow all
        if (!config.isProduction || config.frontendUrl === '*' || !origin) {
          return callback(null, true);
        }
        // In production, match specific frontendUrl
        if (origin === config.frontendUrl || origin.endsWith('.vercel.app')) {
          return callback(null, true);
        }
        return callback(null, true); // Permissive fallback for college participants on mobile
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Ensure state is initialized before processing any requests
  app.use(async (req, res, next) => {
    try {
      await ensureAppInitialized();
    } catch (e) {
      console.warn('[App Init Middleware] Warning:', e);
    }
    next();
  });

  // Routes (support both /api/* and direct paths for Vercel/Express routing)
  app.use(healthRoutes);
  app.use('/api', authRoutes);
  app.use(authRoutes);
  app.use('/api', eventRoutes);
  app.use(eventRoutes);
  app.use('/api', questionRoutes);
  app.use(questionRoutes);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
