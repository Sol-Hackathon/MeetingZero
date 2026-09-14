import { NextResponse } from "next/server";
import { AiUnavailableError } from "./ai";

export function ok<T>(data: T) {
  return NextResponse.json(data);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** 라우트 핸들러에서 던져진 예외를 사용자에게 보여줄 메시지로 변환 */
export function handleError(error: unknown) {
  if (error instanceof AiUnavailableError) {
    return fail(error.message, 503);
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error("[meetingless]", error);
  return fail(`요청을 처리하지 못했습니다: ${message}`, 500);
}
