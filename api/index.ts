import { createApp } from '../server/app';
import { runMigrations } from '../server/db/pool';
import { AuthService } from '../server/services/authService';
import { QuestionService } from '../server/services/questionService';
import { EventService } from '../server/services/eventService';

const app = createApp();

let initialized = false;
let initPromise: Promise<void> | null = null;

async function ensureInitialized() {
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
        console.warn('[Vercel Serverless] Initialization warning:', err);
      } finally {
        initialized = true;
      }
    })();
  }
  return initPromise;
}

export default async function handler(req: any, res: any) {
  await ensureInitialized();
  return app(req, res);
}
