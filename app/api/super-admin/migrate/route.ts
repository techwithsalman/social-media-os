import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export async function GET(req: Request) {
  try {
    const prisma = new PrismaClient();
    
    // Read the migration SQL file
    const sqlPath = path.join(process.cwd(), 'prisma', 'migrations', '20261007120000_add_instagram_auto_dm', 'migration.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by statement (;) and filter empty
    const statements = sqlContent.split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    const results = [];
    
    for (const stmt of statements) {
      // Execute each statement directly against the production database
      try {
        await prisma.\(stmt);
        results.push({ stmt: stmt.substring(0, 50) + '...', status: 'success' });
      } catch (e: any) {
        // If the table or index already exists, it might throw, which is fine
        results.push({ stmt: stmt.substring(0, 50) + '...', status: 'error', error: String(e) });
      }
    }
    
    // Verify tables exist
    let hasRule = false;
    let hasExec = false;
    try {
      // @ts-ignore
      await prisma.instagramAutoDmRule.findFirst();
      hasRule = true;
    } catch (e) {}
    try {
      // @ts-ignore
      await prisma.instagramAutoDmExecution.findFirst();
      hasExec = true;
    } catch (e) {}
    
    return NextResponse.json({ 
      success: true, 
      results,
      InstagramAutoDmRule: hasRule,
      InstagramAutoDmExecution: hasExec
    });
  } catch (e: any) {
    return NextResponse.json({ error: String(e) });
  }
}
