import { createHmac } from 'node:crypto';
import { verifyRevenueCatSignature } from './revenuecat-signature.util';

const SECRET = 'test-secret';

function sign(timestampSeconds: number, rawBody: string): string {
  const hmac = createHmac('sha256', SECRET).update(`${timestampSeconds}.${rawBody}`).digest('hex');
  return `t=${timestampSeconds},v1=${hmac}`;
}

describe('verifyRevenueCatSignature', () => {
  const body = Buffer.from(JSON.stringify({ event: { id: 'evt_1' } }));
  const now = new Date('2026-08-24T12:00:00.000Z');
  const nowSeconds = Math.floor(now.getTime() / 1000);

  it('accepts a correctly signed, recent request', () => {
    const header = sign(nowSeconds, body.toString('utf8'));
    expect(verifyRevenueCatSignature(body, header, SECRET, now)).toEqual({ valid: true });
  });

  it('rejects a missing signature header', () => {
    expect(verifyRevenueCatSignature(body, undefined, SECRET, now)).toEqual({
      valid: false,
      reason: 'missing_header',
    });
  });

  it('rejects a malformed signature header', () => {
    expect(verifyRevenueCatSignature(body, 'not-the-right-format', SECRET, now)).toEqual({
      valid: false,
      reason: 'malformed_header',
    });
  });

  it('rejects a signature computed with the wrong secret', () => {
    const header = sign(nowSeconds, body.toString('utf8'));
    expect(verifyRevenueCatSignature(body, header, 'wrong-secret', now)).toEqual({
      valid: false,
      reason: 'signature_mismatch',
    });
  });

  it('rejects a signature computed over a different body (tampering)', () => {
    const header = sign(nowSeconds, body.toString('utf8'));
    const tamperedBody = Buffer.from(JSON.stringify({ event: { id: 'evt_2' } }));
    expect(verifyRevenueCatSignature(tamperedBody, header, SECRET, now)).toEqual({
      valid: false,
      reason: 'signature_mismatch',
    });
  });

  it('rejects a timestamp outside the tolerance window (replay protection)', () => {
    const staleTimestamp = nowSeconds - 10 * 60; // 10 minutes old
    const header = sign(staleTimestamp, body.toString('utf8'));
    expect(verifyRevenueCatSignature(body, header, SECRET, now)).toEqual({
      valid: false,
      reason: 'timestamp_out_of_tolerance',
    });
  });

  it('accepts a timestamp within the tolerance window', () => {
    const recentTimestamp = nowSeconds - 60; // 1 minute old
    const header = sign(recentTimestamp, body.toString('utf8'));
    expect(verifyRevenueCatSignature(body, header, SECRET, now)).toEqual({ valid: true });
  });
});
