import { createHash } from 'crypto';

/**
 * SHA-256 hash of the raw GCash notification text.
 * This is the dedup key — GCash notifications have no reference number
 * and the OS can redeliver the same notification more than once.
 *
 * @param rawNotification - full raw notification text captured on-device
 * @returns hex-encoded SHA-256 hash
 */
export function hashNotification(rawNotification: string): string {
  return createHash('sha256').update(rawNotification, 'utf8').digest('hex');
}
