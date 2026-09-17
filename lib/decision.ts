import type { Decision, RoundDigest } from "./types";

/** 확정 시각을 뺀, 주최자가 편집하는 부분 */
export type DecisionInput = Omit<Decision, "decidedAt">;

export function emptyDecision(): DecisionInput {
  return { decided: [], toMeet: [], note: "" };
}

/**
 * 라운드 정리 결과들로 결론 초안을 만든다. AI 호출 없음.
 * 정해진 것은 모든 라운드의 합의를 모은다. 정리 프롬프트가 앞 라운드 합의 목록을 받아 다시 쓰지 않도록 돼 있다.
 * 모여서 정할 것은 마지막 라운드의 갈린 것과 미해결에서 가져온다. 참석자는 입장을 낸 사람과 정보를 가진 사람.
 */
export function draftDecision(digests: RoundDigest[]): DecisionInput {
  const last = digests[digests.length - 1];
  if (!last) return emptyDecision();

  const decided: DecisionInput["decided"] = [];

  // AI 가 마지막 라운드에서 제안한 결론 후보가 첫 항목. 주최자가 다듬거나 지운다.
  const proposal = last.proposal?.trim();
  if (proposal) {
    decided.push({
      point: proposal,
      basis: "AI 가 마지막 라운드 답변을 바탕으로 제안한 결론 후보입니다. 확정 전에 다듬거나 지우세요.",
    });
  }

  for (const digest of digests) {
    for (const c of digest.consensus) {
      if (!decided.some((d) => d.point === c.point)) decided.push({ point: c.point, basis: c.basis });
    }
  }

  // AI 가 "지금 내용으로 결론 가능"이라 했으면 남은 갈림은 회의 안건이 아니라 주최자가 고를 항목이다.
  const hostPicks = last.decisionReady && !last.meetingNeeded.needed;
  if (hostPicks) {
    for (const c of last.conflicts) {
      decided.push({
        point: `[주최자 선택] ${c.topic}: ${c.positions
          .map((p) => `${p.stance} (${p.who.join(", ") || "익명"})`)
          .join(" / ")}`,
        basis: c.crux,
      });
    }
  }

  return {
    decided,
    toMeet: [
      ...(hostPicks ? [] : last.conflicts).map((c) => ({
        topic: c.topic,
        crux: c.crux,
        attendees: unique(c.positions.flatMap((p) => p.who)),
      })),
      ...last.unresolved.map((u) => ({
        topic: u.topic,
        crux: u.whyOpen,
        attendees: unique(u.askWho ?? []),
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
