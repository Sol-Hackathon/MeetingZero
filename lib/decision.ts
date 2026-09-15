import type { Decision, RoundDigest } from "./types";

/** 확정 시각을 뺀, 주최자가 편집하는 부분 */
export type DecisionInput = Omit<Decision, "decidedAt">;

export function emptyDecision(): DecisionInput {
  return { decided: [], toMeet: [], note: "" };
}

/**
 * 라운드 정리 결과들로 결론 초안을 만든다. AI 호출 없음.
 * 정해진 것은 모든 라운드의 합의를 모은다. 앞 라운드에서 합의된 것은 뒤 라운드 정리에 다시 나오지 않기 때문.
 * 모여서 정할 것은 마지막 라운드의 갈린 것과 미해결에서 가져온다.
 */
export function draftDecision(digests: RoundDigest[]): DecisionInput {
  const last = digests[digests.length - 1];
  if (!last) return emptyDecision();

  const decided: DecisionInput["decided"] = [];
  for (const digest of digests) {
    for (const c of digest.consensus) {
      if (!decided.some((d) => d.point === c.point)) decided.push({ point: c.point, basis: c.basis });
    }
  }

  return {
    decided,
    toMeet: [
      ...last.conflicts.map((c) => ({
        topic: c.topic,
        crux: c.crux,
        attendees: unique(c.positions.flatMap((p) => p.who)),
      })),
      ...last.unresolved.map((u) => ({
        topic: u.topic,
        crux: u.whyOpen,
        attendees: [] as string[],
      })),
    ],
    note: "",
  };
}

/** 클라이언트가 보낸 결론을 정리한다. 빈 항목은 버리고, 형식이 아니면 null. */
export function normalizeDecision(input: unknown): DecisionInput | null {
  if (!input || typeof input !== "object") return null;
  const body = input as Record<string, unknown>;
  if (!Array.isArray(body.decided) || !Array.isArray(body.toMeet)) return null;

  const decided = body.decided
    .map((item) => {
      const d = (item ?? {}) as Record<string, unknown>;
      return { point: text(d.point), basis: text(d.basis) };
    })
    .filter((d) => d.point.length > 0);

  const toMeet = body.toMeet
    .map((item) => {
      const t = (item ?? {}) as Record<string, unknown>;
      return {
        topic: text(t.topic),
        crux: text(t.crux),
        attendees: Array.isArray(t.attendees) ? unique(t.attendees.map(text)) : [],
      };
    })
    .filter((t) => t.topic.length > 0);

  return { decided, toMeet, note: text(body.note) };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function unique(list: string[]): string[] {
  return Array.from(new Set(list.map((s) => s.trim()).filter(Boolean)));
}
