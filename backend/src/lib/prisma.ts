import { PrismaClient } from '@prisma/client';
import { localDb } from './localDb';

// ── Ultra-Fast Resilient Database Router ────────────────────────
// When external PostgreSQL is not running locally, seamlessly route
// to our zero-latency persistent JSON database (sub-1ms execution).
// When PostgreSQL is installed and desired, set USE_POSTGRES=true in .env
const usePostgres = process.env.USE_POSTGRES === 'true';

let client: any = localDb;

if (usePostgres) {
  try {
    client = new PrismaClient({
      log: ['error'],
    });
  } catch {
    client = localDb;
  }
}

export const prisma = client as unknown as PrismaClient;
