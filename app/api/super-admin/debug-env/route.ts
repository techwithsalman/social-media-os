import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || '';
  const isSame = dbUrl.includes('ep-flat-bonus');
  
  const prisma = new PrismaClient();
  let tables = [];
  let migrations = [];
  
  try {
    const res = await prisma.\\SELECT tablename FROM pg_tables WHERE schemaname='public'\;
    tables = Array.isArray(res) ? res.map(r => r.tablename) : [];
    
    const migs = await prisma.\\SELECT * FROM _prisma_migrations\;
    migrations = Array.isArray(migs) ? migs.map(m => m.migration_name) : [];
  } catch (e) {
    return NextResponse.json({ error: String(e) });
  }

  const hasRule = tables.includes('InstagramAutoDmRule');
  const hasExec = tables.includes('InstagramAutoDmExecution');
  const hasMig = migrations.includes('20261007120000_add_instagram_auto_dm');

  return NextResponse.json({
    SAME_DATABASE: isSame,
    TABLES: tables,
    MIGRATIONS: migrations,
    InstagramAutoDmRule: hasRule,
    InstagramAutoDmExecution: hasExec,
    MIGRATION_APPLIED: hasMig,
  });
}
