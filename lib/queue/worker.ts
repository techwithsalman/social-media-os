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
    },
    take: 10,
  });

  const results = [];
  let claimedCount = 0;

  for (const candidate of dueCandidates) {
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

    // If claimResult.count === 0, another concurrent worker instance already claimed this post
    if (claimResult.count === 0) {
      console.log(`[Queue Worker] Post ${candidate.id} was already claimed by another worker. Skipping.`);
      continue;
    }

    claimedCount++;

    try {
      console.log(`[Queue Worker] Atomically claimed & publishing due post: ${candidate.id}`);
      const result = await PublishingEngine.publishContentPost(candidate.id);
      results.push(result);
    } catch (err) {
      console.error(`[Queue Worker] Failed to publish claimed post ${candidate.id}:`, err);
    }
  }

  // 3. Maintenance trigger: process background media asset cleanup
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
