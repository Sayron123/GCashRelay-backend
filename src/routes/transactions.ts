import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { hashNotification } from '../utils/hash';

const router = Router();

/**
 * POST /api/transactions
 * Inserts a cash-in transaction from GCashNotificationListener.kt.
 *
 * Body:
 *   amount: number (required)
 *   counterparty: string | null
 *   raw_notification: string (required)
 *   device_token: string (required) — identifies + authenticates the sender device
 *
 * Dedup: raw_notification_hash is computed here and enforced unique in Postgres.
 * A duplicate is NOT an error — it's returned as 200, since the OS can redeliver
 * the same notification and the upload queue may retry.
 */
router.post('/', async (req, res) => {
  const { amount, counterparty, raw_notification, device_token } = req.body ?? {};

  // validation
  if (typeof amount !== 'number' || amount <= 0 || Number.isNaN(amount) || !raw_notification || !device_token) {
    return res.status(400).json({ error: 'amount must be a positive number; raw_notification and device_token are required' });
  }

  // Token doubles as auth — reject unknown devices instead of inserting blind.
  const { data: device, error: deviceError } = await supabase
    .from('devices')
    .select('id')
    .eq('token', device_token)
    .maybeSingle();

  if (deviceError) {
    console.error('device lookup failed', deviceError);
    return res.status(500).json({ error: 'device lookup failed' });
  }
  if (!device) {
    return res.status(401).json({ error: 'unknown device token' });
  }

  const raw_notification_hash = hashNotification(raw_notification);

  const { data, error } = await supabase
    .from('transactions')
    .insert({
      type: 'cash_in',
      amount,
      counterparty: counterparty ?? null,
      raw_notification,
      raw_notification_hash,
      device_id: device.id,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique violation on raw_notification_hash — already inserted, not a failure.
  // in the 23505 branch
  const { data: existing, error: existingError } = await supabase
    .from('transactions')
    .select()
    .eq('raw_notification_hash', raw_notification_hash)
    .single();

  if (existingError) {
    console.error('duplicate lookup failed', existingError);
    return res.status(500).json({ error: 'duplicate lookup failed' });
  }
  return res.status(200).json({ duplicate: true, transaction: existing });
    }
    console.error('insert failed', error);
    return res.status(500).json({ error: 'insert failed' });
  }

  // Best-effort — don't fail the request if this update errors.
  await supabase
    .from('devices')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', device.id);

  return res.status(201).json({ duplicate: false, transaction: data });
});

router.get('/', async (req, res) => {
  const limitParam = Number(req.query.limit);
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? Math.min(limitParam, 100)
    : 50;

  const type = typeof req.query.type === 'string' ? req.query.type : undefined;
  if (type && type !== 'cash_in' && type !== 'cash_out') {
    return res.status(400).json({ error: 'type must be cash_in or cash_out' });
  }

  const before = typeof req.query.before === 'string' ? req.query.before : undefined;

  let query = supabase
    .from('transactions')
    .select('*')
    .order('received_at', { ascending: false })
    .limit(limit);

  if (type) query = query.eq('type', type);
  if (before) query = query.lt('received_at', before);

  const { data, error } = await query;

  if (error) {
    console.error('list transactions failed', error);
    return res.status(500).json({ error: 'list transactions failed' });
  }

  return res.status(200).json({ transactions: data });
});

export default router;