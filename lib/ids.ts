import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** URL 에 그대로 노출되는 짧은 ID (혼동되는 글자 제외) */
export function shortId(length = 10): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

/** 주최자/참여자 식별용 비밀 토큰 */
export function secretToken(): string {
  return randomBytes(24).toString("base64url");
}
