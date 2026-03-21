import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './db';
import { authRoutes } from './routes/auth';
import { profileRoutes } from './routes/profile';
import { courseRoutes } from './routes/courses';
import { playbookRoutes } from './routes/playbook';
import { roundRoutes } from './routes/rounds';

const app = new Hono();

app.use('*', cors());
app.use('*', logger());

// Global error handler
app.onError((err, c) => {
  console.error(`[Error] ${err.message}`, err.stack);
  return c.json({ error: 'Internal server error' }, 500);
});

app.route('/auth', authRoutes);
app.route('/profile', profileRoutes);
app.route('/courses', courseRoutes);
app.route('/playbook', playbookRoutes);
app.route('/rounds', roundRoutes);

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

const port = parseInt(process.env.PORT || '3000');

async function start() {
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations applied');
  } catch (err) {
    console.error('Migration error (continuing):', err);
  }
  serve({ fetch: app.fetch, port });
  console.log(`AI Caddie API running on port ${port}`);
}

start();
