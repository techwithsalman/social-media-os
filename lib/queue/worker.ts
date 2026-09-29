import prisma from '../prisma';
import { PublishingEngine } from './publisher';
import { processScheduledMediaCleanup } from '../storage/r2-cleanup';

/**
 * Worker that checks for scheduled posts that are due and triggers publishing.
 * Employs atomic database job claiming so concurrent workers cannot process the same post twice.
 * Also executes periodic background R2 media asset cleanup for completed/abandoned uploads.
 */
export async function processDueScheduledPosts() {
  const now = new Date();
  
  console.log(`\nSCHEDULER TRIGGER:\n${now.toISOString()}`);

  // 1. Find candidate posts marked as SCHEDULED with scheduledFor <= now
  const dueCandidates = await prisma.contentPost.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledFor: {
        lte: now,
      },
    },
    select: {
      id: true,
      scheduledFor: true,
      timezone: true,
    },
    take: 10,
  });

  if (dueCandidates.length === 0) {
    console.log(`[Queue Worker] No due posts found matching status='SCHEDULED' and scheduledFor <= ${now.toISOString()}`);
  }

  const results = [];
  let claimedCount = 0;

  for (const candidate of dueCandidates) {
    console.log(`\nPOST:\n${candidate.id}`);
    console.log(`SCHEDULED AT:\n${candidate.scheduledFor ? candidate.scheduledFor.toISOString() : 'null'}`);
    console.log(`CURRENT UTC:\n${now.toISOString()}`);
    console.log(`TIMEZONE:\n${candidate.timezone || 'UTC'}`);
    
    const isDue = candidate.scheduledFor ? candidate.scheduledFor <= now : false;
    console.log(`DUE:\n${isDue}`);

    // 2. Atomically claim the job: transition status to PROCESSING ONLY IF current status is STILL SCHEDULED
    const claimResult = await prisma.contentPost.updateMany({
      where: {
        id: candidate.id,
        status: 'SCHEDULED',
      },
      data: {
        status: 'PROCESSING',
      },
    });

    if (claimResult.count === 0) {
      console.log(`CLAIM RESULT:\nskipped (already claimed)`);
      continue;
    }

    console.log(`CLAIM RESULT:\nclaimed`);
    claimedCount++;

    try {
      const result = await PublishingEngine.publishContentPost(candidate.id);
      
      const success = result && result.overallStatus && result.overallStatus !== 'FAILED';
      console.log(`PUBLISH RESULT:\n${success ? 'success' : 'failure'}`);
      
      if (!success) {
        console.log(`ERROR:\n`, JSON.stringify(result, null, 2));
      }
      
      results.push(result);
    } catch (err: any) {
      console.log(`PUBLISH RESULT:\nfailure`);
      console.log(`ERROR:\n`, err?.message || err);
      
      // Fallback transition to FAILED if the engine threw an exception completely
      await prisma.contentPost.updateMany({
        where: { id: candidate.id, status: 'PROCESSING' },
        data: { status: 'FAILED' }
      }).catch(() => {});
    }
  }

  // 3. Maintenance trigger: process background media asset cleanup
  console.log('[RECONCILE] Starting automatic reconciliation for PROCESSING posts...');
  await PublishingEngine.reconcileProcessingPosts();

  let cleanupSummary = null;
  try {
    cleanupSummary = await processScheduledMediaCleanup();
    if (cleanupSummary.deletedCount > 0) {
      console.log(`[Queue Worker] Maintenance R2 cleanup deleted ${cleanupSummary.deletedCount} asset(s).`);
    }
  } catch (cleanupErr) {
    console.error('[Queue Worker] Non-critical error during maintenance media cleanup:', cleanupErr);
  }

  return {
    processedCount: claimedCount,
    results,
    cleanupSummary,
  };
}
