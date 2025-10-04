// app/api/config/route.ts
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT clinic_name FROM clinic_configuration LIMIT 1;');
        client.release();

        const config = result.rows[0];

        return NextResponse.json(config);
    } catch (error) {
        console.error('Failed to fetch clinic configuration:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}