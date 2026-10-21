/*
 * 회의 코드: 주최자가 다른 기기에서도 회의를 관리할 수 있게 하는 짧은 열쇠. 로그인 대신 쓴다.
 * 서버와 클라이언트가 같이 쓰므로 Node 전용 API 를 부르지 않는다. 생성은 lib/ids.ts 의 meetingCode().
 *
 * 저장은 소문자 8자(예: "k7mq2xw9"), 화면에는 대문자로 넷씩 끊어 보여준다(예: "K7MQ-2XW9").
 * 입력은 대소문자, 하이픈, 공백을 가리지 않는다. 혼동되는 글자(0 o 1 l)는 애초에 쓰지 않는다.
 */

export const MEETING_CODE_LENGTH = 8;

/** 사용자가 적은 코드를 저장 형식으로. 코드 모양이 아니면 null */
export function normalizeMeetingCode(input: string): string | null {
  const code = input.toLowerCase().replace(/[^a-z0-9]/g, "");
  return code.length === MEETING_CODE_LENGTH ? code : null;
}

/** "k7mq2xw9" → "K7MQ-2XW9" */
export function formatMeetingCode(code: string): string {
  const upper = code.toUpperCase();
  return `${upper.slice(0, 4)}-${upper.slice(4)}`;
}
