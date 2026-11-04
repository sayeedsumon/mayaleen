import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { base32Decode, base32Encode, newTotpSecret, totp, verifyTotp } from "@/server/auth/totp";
import { createSessionToken, readSessionToken } from "@/server/auth/session";
import { can } from "@/server/auth/permissions";

describe("password", () => {
  it("verifies correct and rejects wrong", () => {
    const h = hashPassword("s3cret!");
    expect(verifyPassword("s3cret!", h)).toBe(true);
    expect(verifyPassword("wrong", h)).toBe(false);
    expect(h).not.toContain("s3cret");
  });
  it("salts hashes", () => expect(hashPassword("a")).not.toBe(hashPassword("a")));
});

describe("totp", () => {
  it("matches RFC 6238 test vectors (last 6 digits)", () => {
    const secret = base32Encode(Buffer.from("12345678901234567890"));
    expect(totp(secret, 59_000)).toBe("287082");
    expect(totp(secret, 1111111109_000)).toBe("081804");
  });
  it("base32 round-trips", () => {
    const s = newTotpSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
  });
  it("allows one step of drift but not more", () => {
    const s = newTotpSecret(), t = 1_700_000_000_000;
    expect(verifyTotp(s, totp(s, t), t + 30_000)).toBe(true);
    expect(verifyTotp(s, totp(s, t), t + 90_000)).toBe(false);
  });
});

describe("session token", () => {
  it("round-trips, expires, and rejects tampering", () => {
    const t = createSessionToken("u1", "MANAGER", 1000);
    expect(readSessionToken(t, 2000)).toMatchObject({ uid: "u1", role: "MANAGER" });
    expect(readSessionToken(t, 1000 + 13 * 3600_000)).toBeNull();
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ uid: "u1", role: "ADMIN", exp: 9e15 })).toString("base64url");
    expect(readSessionToken(`${forged}.${sig}`, 2000)).toBeNull();
    expect(readSessionToken(`${body}.x`, 2000)).toBeNull();
    expect(readSessionToken(undefined)).toBeNull();
  });
});

describe("role matrix (PRD §4)", () => {
  it("front desk cannot approve or change settings", () => {
    expect(can("FRONT_DESK", "CREATE_BOOKING")).toBe(true);
    expect(can("FRONT_DESK", "MANAGE_BOOKINGS")).toBe(false);
    expect(can("MANAGER", "MANAGE_BOOKINGS")).toBe(true);
    expect(can("MANAGER", "ADMIN_SETTINGS")).toBe(false);
    expect(can("ADMIN", "ADMIN_SETTINGS")).toBe(true);
  });
});
