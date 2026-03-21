import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('[DB] DATABASE_URL is not set!');
  process.exit(1);
}

console.log('[DB] Connecting to:', connectionString.replace(/:([^:@]+)@/, ':***@'));

const client = postgres(connectionString, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 30,
  ssl: { rejectUnauthorized: false },
  onnotice: () => {},
});

export const db = drizzle(client, { schema });
