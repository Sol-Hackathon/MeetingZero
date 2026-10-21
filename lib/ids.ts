import { randomBytes } from "node:crypto";
import { MEETING_CODE_LENGTH } from "./code";

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

/** 주최자가 다른 기기에서 회의를 찾을 때 입력하는 회의 코드. 형식은 lib/code.ts 참고 */
export function meetingCode(): string {
  return shortId(MEETING_CODE_LENGTH);
}

/** 주최자/참여자 식별용 비밀 토큰 */
export function secretToken(): string {
  return randomBytes(24).toString("base64url");
}
