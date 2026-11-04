import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";

/** Field-level encryption for NID / passport numbers (NFR-06). AES-256-GCM. */
function key(): Buffer {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-f]{64}$/i.test(hex)) {
    if (process.env.NODE_ENV === "production") throw new Error("FIELD_ENCRYPTION_KEY must be 64 hex chars");
    return Buffer.alloc(32, 7); // dev/test only
  }
  return Buffer.from(hex, "hex");
}

const PREFIX = "enc1:";

export function encryptField(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), body]).toString("base64url");
}

/** Returns the plaintext. Values saved before encryption was enabled pass through unchanged. */
export function decryptField(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith(PREFIX)) return stored;
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64url");
  const d = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}

/** Deterministic keyed hash so staff can search by NID without decrypting every row (FR-A07). */
export function blindIndex(plain: string): string {
  return createHmac("sha256", key()).update(plain.trim().toUpperCase()).digest("hex");
}
