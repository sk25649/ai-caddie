// Register crash handlers FIRST before any imports that might fail
process.on('unhandledRejection', (reason) => {
  console.error('[CRASH] Unhandled rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[CRASH] Uncaught exception:', err);
});

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { db } from './db';
import { sql } from 'drizzle-orm';
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

app.get('/', (c) => c.json({ status: 'ok' }));
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.get('/debug/env', (c) => c.json({
  DATABASE_URL: process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@') : 'NOT SET',
  JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET',
  PORT: process.env.PORT ?? 'not set (using 3000)',
  NODE_ENV: process.env.NODE_ENV ?? 'not set',
}));

const port = parseInt(process.env.PORT || '3000');

async function start() {
  // Test DB connection at startup so we can see the error in logs
  console.log('[DB] DATABASE_PUBLIC_URL:', process.env.DATABASE_PUBLIC_URL ? process.env.DATABASE_PUBLIC_URL.replace(/:([^:@]+)@/, ':***@') : 'NOT SET');
  console.log('[DB] DATABASE_URL:', process.env.DATABASE_URL ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':***@') : 'NOT SET');
  try {
    await db.execute(sql`SELECT 1`);
    console.log('[DB] Connection OK');
  } catch (err) {
    console.error('[DB] Connection FAILED:', err);
  }

  serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });
  console.log(`AI Caddie API running on port ${port}`);
}

start();
