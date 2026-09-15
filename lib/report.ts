import type { Decision, MeetingStatus, QuestionKind, Round, RoundDigest } from "./types";

/*
 * 리포트가 받는 데이터. DB 나 API 에 의존하지 않는 순수 함수만 둔다.
 * 서버(마크다운 API)와 클라이언트(인쇄용 화면)가 같이 쓴다.
 */

export interface ReportMeeting {
  id: string;
  title: string;
  background: string;
  goal: string;
  maxRounds: number;
  status: MeetingStatus;
  createdAt: string;
}

export interface ReportSubmission {
  participantName: string;
  submittedAt: string;
  answers: { questionId: number; value: string }[];
}

export type ReportRound = Round & { submissions: ReportSubmission[] };

export interface ReportData {
  meeting: ReportMeeting;
  rounds: ReportRound[];
  decision: Decision | null;
}

const KIND_LABEL: Record<QuestionKind, string> = {
  open: "서술형",
  choice: "선택형",
  scale: "5점 척도",
};

export function questionLabel(kind: QuestionKind): string {
  return KIND_LABEL[kind] ?? kind;
}

// sv-SE 로케일은 "2026-09-14 16:08" 형태를 준다. 화면과 문서 모두 한국 시간 기준.
const dateTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dateOnly = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDateTime(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? dateTime.format(date) : "";
}

export function formatDate(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? dateOnly.format(date) : "";
}

function parse(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 가장 최근에 마감된 라운드의 정리 결과 */
export function lastDigest(rounds: Round[]): RoundDigest | null {
  for (let i = rounds.length - 1; i >= 0; i -= 1) {
    if (rounds[i].digest) return rounds[i].digest;
  }
  return null;
}

/** 머리말에 쓰는 요약 수치와 상태 문구 */
export function reportSummary(data: ReportData) {
  const { meeting, rounds, decision } = data;
  const participants = new Set(rounds.flatMap((r) => r.submissions.map((s) => s.participantName)));
  const closed = rounds.filter((r) => r.status === "closed");
  const lastClosedAt = closed.length ? closed[closed.length - 1].closedAt : null;
  const end = decision?.decidedAt ?? lastClosedAt;
  const start = formatDate(meeting.createdAt);
  const period = end && formatDate(end) !== start ? `${start} ~ ${formatDate(end)}` : start;

  const outcome = decision
    ? `결론 확정 (${formatDateTime(decision.decidedAt)})`
    : meeting.status === "deciding"
      ? "결정 대기"
      : meeting.status === "collecting"
        ? "답변 수집 중"
        : meeting.status === "draft"
          ? "준비 중"
          : "종료 (결론 미기록)";

  return {
    participantCount: participants.size,
    closedRoundCount: closed.length,
    period,
    outcome,
  };
}

/** 회의 전체를 마크다운 문서로. GitHub · 슬랙 · 노션에 그대로 붙여 넣는 용도. */
export function buildMarkdown(data: ReportData): string {
  const { meeting, rounds, decision } = data;
  const summary = reportSummary(data);
  const out: string[] = [];
  const push = (...lines: string[]) => {
    out.push(...lines);
  };

  push(`# ${meeting.title}`, "");
  push(`- 목표: ${meeting.goal || "(명시되지 않음)"}`);
  push(
    `- 진행: ${summary.period} · ${summary.closedRoundCount}라운드 · 참여자 ${summary.participantCount}명`,
  );
  push(`- 상태: ${summary.outcome}`, "");

  push("## 배경", "", meeting.background.trim(), "");

  push("## 결론", "");
  if (decision) {
    push("### 정해진 것", "");
    if (decision.decided.length === 0) push("- (없음)");
    for (const item of decision.decided) {
      push(`- ${item.point}`);
      if (item.basis) push(`  - 근거: ${item.basis}`);
    }
    push("", "### 모여서 정할 것", "");
    if (decision.toMeet.length === 0) push("- (없음. 모일 필요가 없습니다)");
    for (const item of decision.toMeet) {
      push(`- ${item.topic}`);
      if (item.crux) push(`  - 쟁점: ${item.crux}`);
      if (item.attendees.length) push(`  - 참석: ${item.attendees.join(", ")}`);
    }
    if (decision.note) push("", "### 메모", "", decision.note);
    push("");
  } else {
    const digest = lastDigest(rounds);
    if (digest) {
      push(
        `아직 확정되지 않았습니다. 마지막 라운드의 AI 판단은 "${digest.decisionReady ? "결론 가능" : "쟁점 남음"}", "${digest.meetingNeeded.needed ? "실제 회의 권장" : "회의 불필요"}" 입니다.`,
      );
      if (digest.meetingNeeded.reason) push("", quote(digest.meetingNeeded.reason));
    } else {
      push("아직 마감된 라운드가 없습니다.");
    }
    push("");
  }

  for (const round of rounds) {
    push(`## ${round.roundNo}라운드${roundSuffix(round)}`, "");
    if (round.intro) push(quote(round.intro), "");
    push("**질문**", "");
    round.questions.forEach((q, index) => {
      const options =
        q.kind === "choice" && q.options.length ? `: ${q.options.join(" / ")}` : "";
      push(`${index + 1}. ${q.text} _(${questionLabel(q.kind)}${options})_`);
    });
    push("");

    const digest = round.digest;
    if (!digest) continue;

    push(`**요약** ${digest.overview}`, "");
    push(
      `AI 판단: ${digest.decisionReady ? "결론 가능" : "쟁점 남음"} · ${digest.meetingNeeded.needed ? "실제 회의 권장" : "회의 불필요"}${digest.meetingNeeded.reason ? ` (${digest.meetingNeeded.reason})` : ""}`,
      "",
    );

    if (digest.consensus.length) {
      push("**합의된 것**", "");
      for (const c of digest.consensus) {
        push(`- ${c.point}`);
        if (c.basis) push(`  - 근거: ${c.basis}`);
      }
      push("");
    }
    if (digest.conflicts.length) {
      push("**의견이 갈린 것**", "");
      for (const c of digest.conflicts) {
        push(`- ${c.topic}`);
        for (const p of c.positions) {
          push(`  - ${p.stance}${p.who.length ? ` (${p.who.join(", ")})` : ""}`);
        }
        if (c.crux) push(`  - 쟁점: ${c.crux}`);
      }
      push("");
    }
    if (digest.unresolved.length) {
      push("**아직 답이 안 나온 것**", "");
      for (const u of digest.unresolved) {
        push(`- ${u.topic}`);
        if (u.whyOpen) push(`  - ${u.whyOpen}`);
      }
      push("");
    }
  }

  const answered = rounds.filter((r) => r.submissions.length > 0);
  if (answered.length) {
    push("## 부록: 원본 답변", "");
    for (const round of answered) {
      push("<details>", `<summary>${round.roundNo}라운드 · ${round.submissions.length}명</summary>`, "");
      for (const s of round.submissions) {
        push(`### ${s.participantName}`, "");
        round.questions.forEach((q, index) => {
          const answer = s.answers.find((a) => a.questionId === q.id)?.value?.trim();
          push(`**Q${index + 1}. ${q.text}**`, "", quote(answer || "(무응답)"), "");
        });
      }
      push("</details>", "");
    }
  }

  return `${out.join("\n").trimEnd()}\n`;
}

function roundSuffix(round: ReportRound): string {
  if (round.status === "closed") {
    return ` · ${formatDateTime(round.closedAt)} 마감 · 답변 ${round.submissions.length}명`;
  }
  if (round.status === "open") return ` · 답변 수집 중 (${round.submissions.length}명 답변)`;
  return " · 주최자 검토 중";
}

function quote(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}
