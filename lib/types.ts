export type MeetingStatus = "draft" | "collecting" | "deciding" | "closed";
export type RoundStatus = "draft" | "open" | "closed";
export type QuestionKind = "open" | "choice" | "scale";

/** 주최자가 확정한 최종 결론 */
export interface Decision {
  /** 정해진 것 */
  decided: { point: string; basis: string }[];
  /** 모여서 정할 것. attendees 는 그 자리에 있어야 할 사람 */
  toMeet: { topic: string; crux: string; attendees: string[] }[];
  /** 주최자 메모 */
  note: string;
  decidedAt: string;
}

export interface Meeting {
  id: string;
  hostToken: string;
  title: string;
  background: string;
  goal: string;
  maxRounds: number;
  /** draft(검토 중) → collecting(답변 수집) → deciding(결론 대기) → closed(결론 확정) */
  status: MeetingStatus;
  decision: Decision | null;
  /** 주최자가 적어 둔 예상 참여자 이름. 미응답자 표시에 쓴다. 비어 있을 수 있다 */
  expectedParticipants: string[];
  createdAt: string;
}

export interface Question {
  id: number;
  roundId: number;
  orderNo: number;
  text: string;
  intent: string;
  kind: QuestionKind;
  options: string[];
  required: boolean;
}

/** 한 라운드의 답변을 AI가 정리한 결과 */
export interface RoundDigest {
  /** 라운드 전체를 2~4문장으로 요약 */
  overview: string;
  /** 참여자들이 사실상 같은 이야기를 한 지점 */
  consensus: { point: string; basis: string }[];
  /** 의견이 갈린 지점 */
  conflicts: {
    topic: string;
    positions: { stance: string; who: string[] }[];
    crux: string;
  }[];
  /** 답이 나오지 않았거나 정보가 부족해 다음 라운드로 넘겨야 하는 것 */
  unresolved: { topic: string; whyOpen: string }[];
  /** 질문별 요약 */
  perQuestion: { questionId: number; summary: string; notable: string[] }[];
  /** 더 물어볼 것 없이 결론을 낼 수 있는 상태인지 */
  decisionReady: boolean;
  /** 회의가 정말 필요한지에 대한 AI 의견 */
  meetingNeeded: { needed: boolean; reason: string };
}

export interface Round {
  id: number;
  meetingId: string;
  roundNo: number;
  status: RoundStatus;
  intro: string;
  digest: RoundDigest | null;
  openedAt: string | null;
  closedAt: string | null;
  /** 답변 기한. 지나도 제출은 막지 않고 안내만 한다 */
  deadlineAt: string | null;
  questions: Question[];
}

export interface DraftQuestion {
  text: string;
  intent: string;
  kind: QuestionKind;
  options: string[];
  required: boolean;
}
