import { Pool, types } from 'pg';

// Configurar o driver do PostgreSQL para converter NUMERIC/DECIMAL (OID 1700) para number no JS
types.setTypeParser(1700, (val: string) => parseFloat(val));

// Singleton pattern para Next.js hot-reload (evita múltiplos pools em dev)
declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

const pool: Pool =
  global._pgPool ??
  new Pool({
    host: process.env.POSTGRES_HOST || '192.168.15.16',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '07Huk0594@#$',
    database: process.env.POSTGRES_DB || 'postgres',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

if (process.env.NODE_ENV !== 'production') {
  global._pgPool = pool;
}

export default pool;
