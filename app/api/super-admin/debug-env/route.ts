import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || '';
  const isSame = dbUrl.includes('ep-flat-bonus');
  
  const prisma = new PrismaClient();
  let hasRule = false;
  let hasExec = false;
  
  try {
    // @ts-ignore
    await prisma.instagramAutoDmRule.findFirst();
    hasRule = true;
  } catch (e) {
    hasRule = false;
  }

  try {
    // @ts-ignore
    await prisma.instagramAutoDmExecution.findFirst();
    hasExec = true;
  } catch (e) {
    hasExec = false;
  }

  return NextResponse.json({
    dbUrl,
    SAME_DATABASE: isSame,
    InstagramAutoDmRule: hasRule,
    InstagramAutoDmExecution: hasExec,
  });
}
