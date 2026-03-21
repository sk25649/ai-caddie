import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('[DB] WARNING: DATABASE_PUBLIC_URL / DATABASE_URL is not set — DB routes will fail at runtime');
}

const client = postgres(connectionString ?? 'postgresql://localhost/placeholder', {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 30,
});

export const db = drizzle(client, { schema });
