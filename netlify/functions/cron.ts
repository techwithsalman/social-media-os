import type { Config } from "@netlify/functions";

export default async function reqHandler(req: Request) {
  const now = new Date().toISOString();
  console.log(`[NETLIFY CRON] Triggered`);
  console.log(`[NETLIFY CRON] Timestamp UTC: ${now}`);
  
  // Use explicit environment variable or default to the production URL
  const APP_URL = process.env.APP_URL || 'https://social-media-os.netlify.app';
  const CRON_SECRET = process.env.CRON_SECRET || '';
  
  console.log(`[NETLIFY CRON] Calling queue processor...`);
  console.log(`[NETLIFY CRON] Target: ${APP_URL}/api/queue/process`);

  try {
    const res = await fetch(`${APP_URL}/api/queue/process?secret=${CRON_SECRET}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });
    
    console.log(`[NETLIFY CRON] HTTP status: ${res.status} ${res.statusText}`);
    
    const text = await res.text();
    console.log(`[NETLIFY CRON] Response:`, text);
    
    return new Response(text, { 
      status: res.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error(`[NETLIFY CRON] Network error:`, err);
    return new Response("Error", { status: 500 });
  }
}

// OPTION A: Register the Netlify Scheduled Function explicitly in V2 syntax
export const config: Config = {
  schedule: "*/2 * * * *"
};
