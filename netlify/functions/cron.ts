import { schedule } from "@netlify/functions";

// Run every 2 minutes
export const handler = schedule("*/2 * * * *", async (event) => {
  console.log("[SCHEDULER] Triggered by Netlify Cron");
  
  const APP_URL = process.env.APP_URL || process.env.URL || 'https://social-media-os.netlify.app';
  const CRON_SECRET = process.env.CRON_SECRET || '';
  
  console.log(`[SCHEDULER] Hitting API at: ${APP_URL}/api/queue/process`);

  try {
    const res = await fetch(`${APP_URL}/api/queue/process?secret=${CRON_SECRET}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    if (!res.ok) {
      console.error(`[SCHEDULER] Failed with status ${res.status}: ${res.statusText}`);
      const text = await res.text();
      console.error(`[SCHEDULER] Error Body:`, text);
      return { statusCode: res.status };
    }

    const data = await res.json();
    console.log(`[SCHEDULER] Processing result:`, data);
  } catch (err) {
    console.error(`[SCHEDULER] Network error triggering queue processor:`, err);
  }
  
  return {
    statusCode: 200,
  };
});
