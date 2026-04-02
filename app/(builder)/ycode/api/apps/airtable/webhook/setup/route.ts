import { NextRequest } from 'next/server';
import {
  requireConnectionFromBody,
  updateConnection,
  requireAirtableToken,
} from '@/lib/apps/airtable/sync-service';
import { createWebhook } from '@/lib/apps/airtable';
import { noCache } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /ycode/api/apps/airtable/webhook/setup
 * Register an Airtable webhook for a connection's base
 */
export async function POST(request: NextRequest) {
  try {
    const connection = await requireConnectionFromBody(request);

    if (connection.webhookId) {
      return noCache({ error: 'Webhook already registered for this connection' }, 400);
    }

    const token = await requireAirtableToken();

    // Build the public webhook URL from env or request origin
    const baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
      request.nextUrl.origin;
    const notificationUrl = `${baseUrl}/api/airtable-webhook`;

    if (!notificationUrl.startsWith('https://')) {
      return noCache(
        { error: 'Webhook requires a public HTTPS URL. Set NEXT_PUBLIC_SITE_URL in your environment.' },
        400
      );
    }

    const webhook = await createWebhook(token, connection.baseId, connection.tableId, notificationUrl);

    await updateConnection(connection.id, {
      webhookId: webhook.id,
      webhookSecret: webhook.macSecretBase64,
      webhookExpiresAt: webhook.expirationTime,
      webhookCursor: 0,
    });

    return noCache({
      data: {
        webhookId: webhook.id,
        expiresAt: webhook.expirationTime,
      },
    });
  } catch (error) {
    console.error('Error setting up Airtable webhook:', error);
    return noCache(
      { error: error instanceof Error ? error.message : 'Failed to setup webhook' },
      500
    );
  }
}
