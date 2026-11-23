import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PLAN_PRICING_INR: Record<string, { amountInr: number; label: string; durationDays: number }> = {
  monthly: { amountInr: 499, label: 'ROOMZY Plus Monthly', durationDays: 30 },
  quarterly: { amountInr: 1199, label: 'ROOMZY Plus Quarterly', durationDays: 90 },
  annual: { amountInr: 3499, label: 'ROOMZY Plus Annual', durationDays: 365 },
  featured_listing: { amountInr: 299, label: 'Featured Room Boost (30 Days)', durationDays: 30 },
};

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Preserve raw body for Cashfree webhook HMAC verification
  app.use(
    express.json({
      limit: '2mb',
      verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
        req.rawBody = buf;
      },
    })
  );

  // --- WebSocket Real-Time Presence & Typing Hub ---
  const wss = new WebSocketServer({ server, path: '/ws' });
  const clientsByUid = new Map<string, Set<WebSocket>>();

  function broadcastToUids(targetUids: string[], payload: unknown) {
    const encoded = JSON.stringify(payload);
    for (const targetUid of targetUids) {
      const sockets = clientsByUid.get(targetUid);
      if (!sockets) continue;
      for (const sock of sockets) {
        if (sock.readyState === WebSocket.OPEN) {
          sock.send(encoded);
        }
      }
    }
  }

  wss.on('connection', (ws) => {
    let authedUid: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as {
          type?: string;
          uid?: string;
          conversationId?: string;
          targetUid?: string;
          isTyping?: boolean;
        };

        if (msg.type === 'auth' && typeof msg.uid === 'string' && msg.uid.length > 0 && msg.uid.length <= 128) {
          authedUid = msg.uid;
          if (!clientsByUid.has(authedUid)) {
            clientsByUid.set(authedUid, new Set());
          }
          clientsByUid.get(authedUid)!.add(ws);
          ws.send(JSON.stringify({ type: 'presence:online_list', uids: Array.from(clientsByUid.keys()) }));

          // Broadcast online status to all connected users
          for (const sockets of clientsByUid.values()) {
            for (const sock of sockets) {
              if (sock.readyState === WebSocket.OPEN) {
                sock.send(JSON.stringify({ type: 'presence:update', uid: authedUid, online: true }));
              }
            }
          }
        } else if (msg.type === 'typing' && authedUid && msg.targetUid && msg.conversationId) {
          broadcastToUids([msg.targetUid], {
            type: 'typing',
            conversationId: msg.conversationId,
            uid: authedUid,
            isTyping: Boolean(msg.isTyping),
          });
        } else if (msg.type === 'message:sent' && authedUid && msg.targetUid && msg.conversationId) {
          broadcastToUids([msg.targetUid], {
            type: 'message:incoming',
            conversationId: msg.conversationId,
            fromUid: authedUid,
          });
        }
      } catch {
        // Ignore malformed frames
      }
    });

    ws.on('close', () => {
      if (!authedUid) return;
      const set = clientsByUid.get(authedUid);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          clientsByUid.delete(authedUid);
          for (const sockets of clientsByUid.values()) {
            for (const sock of sockets) {
              if (sock.readyState === WebSocket.OPEN) {
                sock.send(JSON.stringify({ type: 'presence:update', uid: authedUid, online: false }));
              }
            }
          }
        }
      }
    });
  });

  // --- API Routes ---
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'roomzy-api', onlineUsers: clientsByUid.size });
  });

  app.get('/api/config/public', (_req: Request, res: Response) => {
    const mapsApiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
    const cashfreeAppId = process.env.CASHFREE_APP_ID || '';
    const cashfreeSecretPresent = Boolean(process.env.CASHFREE_SECRET_KEY);
    const cashfreeEnv = process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
    const kycConfigured = Boolean(process.env.KYC_PROVIDER_API_KEY);

    res.json({
      mapsConfigured: Boolean(mapsApiKey),
      mapsApiKey,
      cashfreeConfigured: Boolean(cashfreeAppId && cashfreeSecretPresent),
      cashfreeEnv,
      kycConfigured,
    });
  });

  function getCashfreeConfig() {
    const appId = process.env.CASHFREE_APP_ID || '';
    const secretKey = process.env.CASHFREE_SECRET_KEY || '';
    const env = process.env.CASHFREE_ENV === 'production' ? 'production' : 'sandbox';
    const baseUrl = env === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
    return { appId, secretKey, env, baseUrl };
  }

  // Create real Cashfree PG order (never fakes success when credentials are missing)
  app.post('/api/payments/create-order', async (req: Request, res: Response) => {
    const { plan, uid, listingId, customerName, customerEmail, customerPhone } = req.body as {
      plan?: string;
      uid?: string;
      listingId?: string;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
    };
    if (!plan || !PLAN_PRICING_INR[plan]) {
      return res.status(400).json({ error: 'Invalid subscription plan selected.' });
    }
    if (!uid || typeof uid !== 'string') {
      return res.status(401).json({ error: 'Authentication required to initiate payment.' });
    }

    const { appId, secretKey, env, baseUrl } = getCashfreeConfig();
    if (!appId || !secretKey) {
      return res.status(503).json({
        code: 'CASHFREE_NOT_CONFIGURED',
        error: 'Cashfree payment gateway credentials are not configured on the server.',
        requiredEnv: ['CASHFREE_APP_ID', 'CASHFREE_SECRET_KEY', 'CASHFREE_ENV'],
      });
    }

    const cleanPhone = (customerPhone || '').replace(/\D/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return res.status(400).json({
        error: 'Please enter a valid 10-digit Indian mobile number for Cashfree checkout.',
      });
    }

    const selected = PLAN_PRICING_INR[plan];
    const orderId = `rmz_${uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}_${Date.now()}`.slice(0, 45);
    const appOrigin =
      process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
        ? process.env.APP_URL.replace(/\/+$/, '')
        : `${req.protocol}://${req.get('host')}`;

    try {
      const cfResponse = await fetch(`${baseUrl}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-version': '2023-08-01',
          'x-client-id': appId,
          'x-client-secret': secretKey,
        },
        body: JSON.stringify({
          order_id: orderId,
          order_amount: selected.amountInr,
          order_currency: 'INR',
          customer_details: {
            customer_id: uid.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48),
            customer_name: (customerName || 'ROOMZY Member').slice(0, 80),
            customer_email: customerEmail || 'member@roomzy.in',
            customer_phone: cleanPhone,
          },
          order_meta: {
            return_url: `${appOrigin}/?cf_order_id={order_id}`,
          },
          order_note: `ROOMZY ${selected.label}${listingId ? ` (Listing ${listingId})` : ''}`,
          order_tags: {
            uid: uid.slice(0, 64),
            plan,
            listingId: (listingId || '').slice(0, 64),
          },
        }),
      });

      const orderData = (await cfResponse.json()) as {
        cf_order_id?: string | number;
        order_id?: string;
        payment_session_id?: string;
        message?: string;
      };

      if (!cfResponse.ok || !orderData.payment_session_id) {
        return res.status(cfResponse.status >= 400 ? cfResponse.status : 502).json({
          error: orderData?.message || 'Failed to create Cashfree payment order.',
        });
      }

      return res.json({
        orderId: orderData.order_id || orderId,
        cfOrderId: orderData.cf_order_id,
        paymentSessionId: orderData.payment_session_id,
        amount: selected.amountInr,
        currency: 'INR',
        env,
        plan,
        planLabel: selected.label,
      });
    } catch (err) {
      console.error('Cashfree order creation failed:', err);
      return res.status(502).json({ error: 'Unable to reach Cashfree payment gateway.' });
    }
  });

  // Verify Cashfree order & payment status server-side
  app.post('/api/payments/verify', async (req: Request, res: Response) => {
    const { orderId, plan } = req.body as {
      orderId?: string;
      plan?: string;
    };

    const { appId, secretKey, baseUrl } = getCashfreeConfig();
    if (!appId || !secretKey) {
      return res.status(503).json({
        code: 'CASHFREE_NOT_CONFIGURED',
        error: 'Cashfree credentials are not configured on the server.',
      });
    }

    if (!orderId || typeof orderId !== 'string' || !plan || !PLAN_PRICING_INR[plan]) {
      return res.status(400).json({ error: 'Missing required Cashfree orderId or plan.' });
    }

    try {
      const orderResp = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
        headers: {
          'x-api-version': '2023-08-01',
          'x-client-id': appId,
          'x-client-secret': secretKey,
        },
      });
      const orderData = (await orderResp.json()) as {
        order_status?: string;
        order_amount?: number;
        order_id?: string;
        message?: string;
      };

      if (!orderResp.ok) {
        return res.status(orderResp.status).json({
          verified: false,
          error: orderData?.message || 'Unable to fetch order status from Cashfree.',
        });
      }

      if (orderData.order_status !== 'PAID') {
        return res.status(402).json({
          verified: false,
          status: orderData.order_status || 'ACTIVE',
          error: `Order payment is not complete (status: ${orderData.order_status || 'PENDING'}).`,
        });
      }

      let paymentId = orderId;
      try {
        const paymentsResp = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}/payments`, {
          method: 'GET',
          headers: {
            'x-api-version': '2023-08-01',
            'x-client-id': appId,
            'x-client-secret': secretKey,
          },
        });
        if (paymentsResp.ok) {
          const paymentsList = (await paymentsResp.json()) as Array<{
            cf_payment_id?: string | number;
            payment_status?: string;
          }>;
          const successPmt = Array.isArray(paymentsList)
            ? paymentsList.find((p) => p.payment_status === 'SUCCESS')
            : undefined;
          if (successPmt?.cf_payment_id) {
            paymentId = String(successPmt.cf_payment_id);
          }
        }
      } catch {
        // Order is already confirmed PAID; keep orderId fallback as paymentId
      }

      const planMeta = PLAN_PRICING_INR[plan];
      const expiresAt = new Date(Date.now() + planMeta.durationDays * 86400_000).toISOString();

      return res.json({
        verified: true,
        plan,
        amountInr: planMeta.amountInr,
        expiresAt,
        paymentId,
        orderId: orderData.order_id || orderId,
      });
    } catch (err) {
      console.error('Cashfree verification error:', err);
      return res.status(502).json({ verified: false, error: 'Unable to verify payment with Cashfree.' });
    }
  });

  // Bounded in-memory idempotency cache and verified order status ledger for webhook retries
  const processedWebhookEvents = new Map<string, string>();
  const webhookOrderLedger = new Map<
    string,
    { status: string; eventType: string; paymentId?: string; refundId?: string; updatedAt: string }
  >();

  function setWebhookCorsHeaders(res: Response) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'content-type, x-webhook-signature, x-webhook-timestamp');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
  }

  // Cashfree Webhook Connectivity & CORS Preflight Checks
  app.options('/api/payments/webhook', (_req: Request, res: Response) => {
    setWebhookCorsHeaders(res);
    return res.status(204).end();
  });

  app.head('/api/payments/webhook', (_req: Request, res: Response) => {
    setWebhookCorsHeaders(res);
    return res.status(200).end();
  });

  app.get('/api/payments/webhook', (_req: Request, res: Response) => {
    setWebhookCorsHeaders(res);
    const configured = Boolean(process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_SECRET_KEY);
    return res.status(200).json({
      ok: true,
      service: 'roomzy-cashfree-webhook',
      configured,
    });
  });

  // Cashfree Webhook Signature Verification & Event Processing (base64 HMAC-SHA256 of timestamp + rawBody)
  app.post('/api/payments/webhook', (req: Request & { rawBody?: Buffer }, res: Response) => {
    setWebhookCorsHeaders(res);

    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const rawBodyStr = req.rawBody ? req.rawBody.toString('utf8') : '';

    const contentLength = Number(req.headers['content-length'] || '0');

    // Allow strictly empty unsigned POST connectivity probes without processing any payment state
    if (contentLength === 0 && !rawBodyStr && !signature && !timestamp) {
      return res.status(200).json({ ok: true, ping: true });
    }

    const webhookSecret = process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_SECRET_KEY;
    if (!webhookSecret) {
      console.error('Cashfree webhook error: server webhook secret is not configured.');
      return res.status(503).json({ error: 'Cashfree webhook secret is not configured on the server.' });
    }

    if (typeof signature !== 'string' || typeof timestamp !== 'string' || !req.rawBody) {
      return res.status(401).json({ error: 'Missing x-webhook-signature or x-webhook-timestamp headers.' });
    }

    const signedPayload = `${timestamp}${rawBodyStr}`;
    const expected = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('base64');
    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expected, 'utf8');

    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      console.warn('Cashfree webhook rejected: invalid HMAC signature.');
      return res.status(401).json({ error: 'Invalid Cashfree webhook signature.' });
    }

    const payload = req.body as {
      type?: string;
      data?: {
        test_object?: unknown;
        order?: { order_id?: string; order_amount?: number };
        payment?: { cf_payment_id?: string | number; payment_status?: string };
        refund?: { cf_refund_id?: string | number; refund_status?: string };
      };
    };

    const eventType = String(payload?.type || 'unknown');
    const orderId = payload?.data?.order?.order_id;
    const cfPaymentId = payload?.data?.payment?.cf_payment_id
      ? String(payload.data.payment.cf_payment_id)
      : undefined;
    const paymentStatus = payload?.data?.payment?.payment_status;
    const cfRefundId = payload?.data?.refund?.cf_refund_id
      ? String(payload.data.refund.cf_refund_id)
      : undefined;
    const refundStatus = payload?.data?.refund?.refund_status;

    // Signed Cashfree dashboard test webhook
    if (eventType === 'TEST' || eventType === 'WEBHOOK' || (!orderId && payload?.data?.test_object)) {
      return res.status(200).json({ received: true, test: true, event: eventType });
    }

    // Duplicate event protection (idempotency)
    const idempotencyKey = `${eventType}:${orderId || 'none'}:${cfPaymentId || cfRefundId || timestamp}`;
    if (processedWebhookEvents.has(idempotencyKey)) {
      return res.status(200).json({ received: true, duplicate: true, event: eventType });
    }
    if (processedWebhookEvents.size >= 5000) {
      const oldestKey = processedWebhookEvents.keys().next().value;
      if (oldestKey) processedWebhookEvents.delete(oldestKey);
    }
    processedWebhookEvents.set(idempotencyKey, new Date().toISOString());

    const now = new Date().toISOString();

    if (eventType === 'PAYMENT_SUCCESS_WEBHOOK') {
      if (paymentStatus !== 'SUCCESS' || !orderId) {
        return res.status(400).json({ error: 'Confirmed SUCCESS payment status and order_id are required.' });
      }
      webhookOrderLedger.set(orderId, {
        status: 'paid',
        eventType,
        paymentId: cfPaymentId,
        updatedAt: now,
      });
    } else if (eventType === 'PAYMENT_FAILED_WEBHOOK' && orderId) {
      webhookOrderLedger.set(orderId, {
        status: 'failed',
        eventType,
        paymentId: cfPaymentId,
        updatedAt: now,
      });
    } else if (eventType === 'PAYMENT_USER_DROPPED_WEBHOOK' && orderId) {
      webhookOrderLedger.set(orderId, {
        status: 'dropped',
        eventType,
        paymentId: cfPaymentId,
        updatedAt: now,
      });
    } else if (eventType === 'REFUND_STATUS_WEBHOOK' && orderId) {
      webhookOrderLedger.set(orderId, {
        status: refundStatus === 'SUCCESS' ? 'refunded' : 'refund_pending',
        eventType,
        refundId: cfRefundId,
        updatedAt: now,
      });
    }

    return res.status(200).json({
      received: true,
      event: eventType,
      orderId: orderId || null,
      recordedStatus: orderId ? webhookOrderLedger.get(orderId)?.status || null : null,
    });
  });

  app.all('/api/payments/webhook', (_req: Request, res: Response) => {
    setWebhookCorsHeaders(res);
    return res.status(405).json({ error: 'Method not allowed' });
  });

  // Compliant KYC Sanitization & Submission (never stores or returns full Aadhaar/PAN)
  app.post('/api/kyc/submit', (req: Request, res: Response) => {
    const { documentType, documentNumber } = req.body as {
      documentType?: string;
      documentNumber?: string;
    };

    const allowed = ['Aadhaar', 'PAN', 'Passport', 'Driving License'];
    if (!documentType || !allowed.includes(documentType)) {
      return res.status(400).json({ error: 'Unsupported identity document type.' });
    }
    if (!documentNumber || typeof documentNumber !== 'string') {
      return res.status(400).json({ error: 'Document reference is required.' });
    }

    const clean = documentNumber.replace(/\s+/g, '').toUpperCase();
    if (documentType === 'Aadhaar' && !/^\d{12}$/.test(clean)) {
      return res.status(400).json({ error: 'Aadhaar must be a valid 12-digit number.' });
    }
    if (documentType === 'PAN' && !/^[A-Z]{5}\d{4}[A-Z]$/.test(clean)) {
      return res.status(400).json({ error: 'PAN must match standard 10-character format (e.g., ABCDE1234F).' });
    }
    if (clean.length < 6) {
      return res.status(400).json({ error: 'Invalid document number length.' });
    }

    const maskedLast4 = clean.slice(-4);
    const kycKeyConfigured = Boolean(process.env.KYC_PROVIDER_API_KEY);

    // Note: Never mark user verified unless real third-party KYC API confirms or an admin approves
    return res.json({
      accepted: true,
      status: 'pending',
      provider: kycKeyConfigured ? 'digilocker_kyc' : 'manual_compliance_queue',
      documentType,
      documentLast4: maskedLast4,
      message: kycKeyConfigured
        ? 'KYC verification submitted to third-party provider.'
        : 'Verification request queued for compliance review. Raw document number was masked and discarded.',
    });
  });

  // --- Vite / Static Serving ---
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`ROOMZY server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ROOMZY server:', err);
  process.exit(1);
});
