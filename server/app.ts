import express from 'express';
import cors from 'cors';
import { config } from './config';
import healthRoutes from './routes/healthRoutes';
import authRoutes from './routes/authRoutes';
import eventRoutes from './routes/eventRoutes';
import questionRoutes from './routes/questionRoutes';
import { errorHandler } from './middleware/errorHandler';

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

  // Routes
  app.use(healthRoutes);
  app.use('/api', authRoutes);
  app.use('/api', eventRoutes);
  app.use('/api', questionRoutes);

  // Centralized Error Handler
  app.use(errorHandler);

  return app;
}
