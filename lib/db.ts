// lib/db.ts

// Esta función usa una importación dinámica.
// Esto le dice a Next.js: "No incluyas 'pg' en el código del navegador".
// Solo se cargará en un entorno de servidor.
async function getPool() {
  const { Pool } = await import('pg');

  // Usamos una variable global para no crear una nueva conexión cada vez.
  if (!(global as any).pgPool) {
    (global as any).pgPool = new Pool({
      user: 'postgres',
      host: 'db',
      database: 'vetclinic',
      password: 'postgres',
      port: 5432,
    });
  }
  return (global as any).pgPool;
}

// Este es el objeto que el resto de la aplicación usa.
// Mantiene la misma estructura que el código original esperaba.
export const supabase = {
  from: (tableName: string) => ({
    select: async (query = '*') => {
      // Si este código intenta correr en el navegador, no hará nada y devolverá una lista vacía.
      // Esto evita que la aplicación se rompa durante la compilación.
      if (typeof window !== 'undefined') {
        console.warn("Database operations are server-side only. Returning empty data for client-side render.");
        return { data: [], error: null };
      }

      try {
        const pool = await getPool();
        const client = await pool.connect();
        // Construimos una consulta simple.
        const sqlQuery = `SELECT ${query.replace(/, /g, ', ')} FROM "${tableName}";`;
        const res = await client.query(sqlQuery);
        client.release();
        return { data: res.rows, error: null };
      } catch (error: any) {
        console.error(`Error executing query on ${tableName}:`, error);
        return { data: null, error: { message: error.message, details: '', hint: '', code: '' } };
      }
    },
    // Aquí se podrían agregar otras funciones como insert, update, etc.
  }),
};