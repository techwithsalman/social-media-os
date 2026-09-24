export interface Env {
  APP_URL: string;
  CRON_SECRET: string;
}

export interface ScheduledEvent {
  cron: string;
  scheduledTime: number;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const targetUrl = `${env.APP_URL.replace(/\/+$/, '')}/api/queue/process`;
    console.log(`[Cloudflare Worker Cron] Triggering scheduled queue processor at ${targetUrl}`);

    try {
      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.CRON_SECRET}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Cloudflare-Worker-Scheduled-Cron/1.0',
        },
      });

      const body = await response.text();
      console.log(`[Cloudflare Worker Cron] Response status ${response.status}: ${body}`);
    } catch (error) {
      console.error('[Cloudflare Worker Cron] Failed to trigger queue processor:', error);
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return new Response(
      JSON.stringify({
        service: 'Social Media OS Cloudflare Scheduled Worker',
        status: 'active',
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};
