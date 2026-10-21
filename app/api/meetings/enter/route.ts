import { findMeetingByCode } from "@/lib/db";
import { normalizeMeetingCode } from "@/lib/code";
import { fail, handleError, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * 회의 코드로 주최자 화면에 들어간다. 코드가 맞으면 주최자 토큰을 돌려주고, 화면은 그 토큰으로 이동한다.
 * 코드는 32^8(약 1조) 가지라 맞히기는 어렵지만, 무작정 찔러 보는 것은 IP 마다 횟수를 제한해 막는다.
 */

const WINDOW_MS = 10 * 60_000;
const MAX_FAILS = 10;
const fails = new Map<string, { count: number; until: number }>();

function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? request.headers.get("x-real-ip") ?? "local").trim();
}

function tooMany(key: string): boolean {
  const entry = fails.get(key);
  if (!entry) return false;
  if (entry.until < Date.now()) {
    fails.delete(key);
    return false;
  }
  return entry.count >= MAX_FAILS;
}

function recordFail(key: string): void {
  const entry = fails.get(key);
  if (entry && entry.until >= Date.now()) entry.count += 1;
  else fails.set(key, { count: 1, until: Date.now() + WINDOW_MS });
}

export async function POST(request: Request) {
  try {
    const key = clientKey(request);
    if (tooMany(key)) return fail("시도가 너무 많습니다. 10분 뒤에 다시 해 주세요.", 429);

    const body = (await request.json().catch(() => ({}))) as { code?: unknown };
    const code = normalizeMeetingCode(typeof body.code === "string" ? body.code : "");
    if (!code) return fail("회의 코드는 영문과 숫자 8자입니다.");

    const meeting = findMeetingByCode(code);
    if (!meeting) {
      recordFail(key);
      return fail("그 코드로 된 회의가 없습니다. 다시 확인해 주세요.", 404);
    }
    fails.delete(key);

    return ok({ meetingId: meeting.id, hostToken: meeting.hostToken, title: meeting.title });
  } catch (error) {
    return handleError(error);
  }
}
