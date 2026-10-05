import type { Config } from "@netlify/functions";

export default async function reqHandler(req: Request) {
  const now = new Date().toISOString();
  console.log(`[NETLIFY CRON] Triggered`);
  console.log(`[NETLIFY CRON] Timestamp UTC: ${now}`);
  
  console.log(`[NETLIFY CRON] process.env.URL: ${process.env.URL || 'undefined'}`);
  console.log(`[NETLIFY CRON] process.env.DEPLOY_PRIME_URL: ${process.env.DEPLOY_PRIME_URL || 'undefined'}`);
  console.log(`[NETLIFY CRON] process.env.APP_URL: ${process.env.APP_URL || 'undefined'}`);

  const rawBaseUrl =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://app.techwithsalman.online');

  const baseUrl = rawBaseUrl.replace(/\/$/, '');

  const target = `${baseUrl}/api/queue/process`;
  console.log(`[NETLIFY CRON] Resolved base URL: ${baseUrl}`);
  console.log(`[NETLIFY CRON] Target: ${target}`);

  if (target.includes('localhost') || target.includes('127.0.0.1')) {
    console.error(`[NETLIFY CRON] FATAL CONFIG ERROR: Target resolved to localhost. Aborting.`);
    return new Response("Configuration Error", { status: 500 });
  }

  const CRON_SECRET = process.env.CRON_SECRET || '';
  
  console.log(`[NETLIFY CRON] Calling queue processor...`);

  try {
    const res = await fetch(`${target}?secret=${CRON_SECRET}`, {
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
