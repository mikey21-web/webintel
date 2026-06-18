import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '../config';
import * as schema from './schema';

const queryClient = postgres(config.DATABASE_URL, {
  max: 10,
  connect_timeout: 10,
} as any);
export const db = drizzle(queryClient, { schema });
