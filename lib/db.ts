// lib/db.ts
import { Pool } from 'pg';

let pool;

if (!pool) {
  pool = new Pool({
    user: 'postgres',
    host: 'db',
    database: 'vetclinic',
    password: 'postgres',
    port: 5432,
  });
}

export default pool;