import { createHmac, timingSafeEqual } from 'node:crypto';

const DEFAULT_TOLERANCE_SECONDS = 5 * 60;

export type SignatureVerificationResult =
  | { valid: true }
  | {
      valid: false;
      reason:
        'missing_header' | 'malformed_header' | 'timestamp_out_of_tolerance' | 'signature_mismatch';
    };

/**
 * Verifies RevenueCat's HMAC-SHA256 webhook signature.
 *
 * Header format: `X-RevenueCat-Webhook-Signature: t=<unix_seconds>,v1=<hex>`
 * Signed content: `"<timestamp>.<raw_body>"`, computed over the raw request
 * bytes — this MUST be the body exactly as received, before JSON parsing,
 * or every signature will mismatch.
 */
export function verifyRevenueCatSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
  now: Date = new Date(),
  toleranceSeconds: number = DEFAULT_TOLERANCE_SECONDS,
): SignatureVerificationResult {
  if (!signatureHeader) {
    return { valid: false, reason: 'missing_header' };
  }

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => {
      const [key, value] = part.split('=');
      return [key, value];
    }),
  );
  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature || !/^\d+$/.test(timestamp)) {
    return { valid: false, reason: 'malformed_header' };
  }

  const ageSeconds = Math.abs(now.getTime() / 1000 - Number(timestamp));
  if (ageSeconds > toleranceSeconds) {
    return { valid: false, reason: 'timestamp_out_of_tolerance' };
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody.toString('utf8')}`)
    .digest('hex');

  if (!constantTimeEqual(signature, expected)) {
    return { valid: false, reason: 'signature_mismatch' };
  }

  return { valid: true };
}

function constantTimeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');
  if (bufferA.length !== bufferB.length) {
    return false;
  }
  return timingSafeEqual(bufferA, bufferB);
}
