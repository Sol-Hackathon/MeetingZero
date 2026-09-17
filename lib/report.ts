import type { Decision, MeetingStatus, QuestionKind, Round, RoundDigest } from "./types";

/*
 * 리포트 데이터와 문서를 만드는 순수 함수. DB 나 API 에 의존하지 않는다.
 * 서버(마크다운 · 요약 API)와 클라이언트(인쇄용 화면)가 같은 순서, 같은 문구를 쓴다.
 *
 * 문서 순서는 독자가 묻는 순서를 따른다.
 *   결론(뭐가 정해졌나) → 근거(왜) → 진행 경과(어떻게) → 배경 → 부록(원자료)
 * 결론은 마지막 라운드 정리에서 나온 것이므로, 라운드마다 정리를 통째로 반복하지 않는다.
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

/* ------------------------------------------------------------------ */
/* 날짜                                                                 */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/* 데이터 뽑기                                                           */
/* ------------------------------------------------------------------ */

/** 가장 최근에 마감된 라운드 */
export function lastClosedRound(rounds: ReportRound[]): ReportRound | null {
  for (let i = rounds.length - 1; i >= 0; i -= 1) {
    if (rounds[i].status === "closed" && rounds[i].digest) return rounds[i];
  }
  return null;
}

/** 가장 최근 라운드의 정리 결과 */
export function lastDigest(rounds: Round[]): RoundDigest | null {
  for (let i = rounds.length - 1; i >= 0; i -= 1) {
    if (rounds[i].digest) return rounds[i].digest;
  }
  return null;
}

/** 답변한 사람 전체. 처음 등장한 순서 */
export function participantNames(rounds: ReportRound[]): string[] {
  const names: string[] = [];
  for (const round of rounds) {
    for (const submission of round.submissions) {
      if (!names.includes(submission.participantName)) names.push(submission.participantName);
    }
  }
  return names;
}

/** 이름 목록을 짧게. 전원이면 이름을 나열하지 않는다. */
export function namesLabel(names: string[], all: string[]): string {
  const clean = names.map((n) => n.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (all.length > 1 && clean.length >= all.length && all.every((n) => clean.includes(n))) {
    return `참여자 전원 (${all.length}명)`;
  }
  return clean.join(", ");
}

/** 첫 문장만 */
export function firstSentence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^(.+?[.!?。])(?:\s|$)/);
  return match ? match[1] : trimmed;
}

/** 진행 경과 표의 AI 판단 칸. 축 이름을 붙여야 "쟁점 남음 · 회의 불필요"처럼 모순으로 읽히지 않는다. */
export function aiVerdict(digest: RoundDigest): string {
  return `결론 ${digest.decisionReady ? "가능" : "미정"} · 회의 ${digest.meetingNeeded.needed ? "필요" : "불필요"}`;
}

/** AI 의견 한 문장 (판단 + 이유) */
export function aiOpinion(digest: RoundDigest): string {
  const reason = digest.meetingNeeded.reason.trim();
  return reason ? `${aiVerdict(digest)}. ${reason}` : aiVerdict(digest);
}

/** 리포트 맨 위 한 줄 */
export function oneLineSummary(data: ReportData): string {
  const { decision, rounds } = data;
  if (decision) {
    const decided = decision.decided.length;
    const toMeet = decision.toMeet.length;
    if (toMeet === 0) return `정해진 것 ${decided}건. 모일 필요 없이 마무리했습니다.`;
    return `정해진 것 ${decided}건. 모여서 정할 것 ${toMeet}건: ${decision.toMeet.map((t) => t.topic).join(", ")}`;
  }
  const digest = lastDigest(rounds);
  if (!digest) return "아직 마감된 라운드가 없습니다.";
  return `아직 확정 전입니다. AI 의견은 "${aiVerdict(digest)}"입니다.`;
}

/** 머리말에 쓰는 요약 수치와 상태 문구 */
export function reportSummary(data: ReportData) {
  const { meeting, rounds, decision } = data;
  const participants = participantNames(rounds);
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
    participants,
    participantCount: participants.length,
    closedRoundCount: closed.length,
    period,
    outcome,
  };
}

/* ------------------------------------------------------------------ */
/* 마크다운 (GitHub · 노션용 전문)                                        */
/* ------------------------------------------------------------------ */

export function buildMarkdown(data: ReportData): string {
  const { meeting, rounds, decision } = data;
  const summary = reportSummary(data);
  const all = summary.participants;
  const out: string[] = [];
  const push = (...lines: string[]) => {
    out.push(...lines);
  };

  push(`# ${meeting.title}`, "");
  if (meeting.goal) push(`- 목표: ${meeting.goal}`);
  push(`- 기간: ${summary.period} · ${summary.closedRoundCount}라운드`);
  push(`- 참여자: ${all.length ? `${all.join(", ")} (${all.length}명)` : "없음"}`);
  push(`- 상태: ${summary.outcome}`, "");

  /* 결론 */
  push("## 결론", "", `**${oneLineSummary(data)}**`, "");
  if (decision) {
    push("### 정해진 것", "");
    if (decision.decided.length === 0) push("없음");
    decision.decided.forEach((item, index) => {
      push(`${index + 1}. ${item.point}`);
      if (item.basis) push(`   - 근거: ${item.basis}`);
    });
    push("", "### 모여서 정할 것", "");
    if (decision.toMeet.length === 0) push("없음. 모일 필요가 없습니다.");
    decision.toMeet.forEach((item, index) => {
      push(`${index + 1}. ${item.topic}`);
      if (item.crux) push(`   - 쟁점: ${item.crux}`);
      if (item.attendees.length) push(`   - 참석: ${namesLabel(item.attendees, all)}`);
    });
    if (decision.note) push("", "### 주최자 메모", "", decision.note);
    push("", `_${formatDateTime(decision.decidedAt)} 확정_`, "");
  } else {
    push("아직 확정되지 않았습니다.", "");
  }

  /* 근거: 마지막 라운드의 AI 정리. 결론에 이미 옮겨진 합의 항목은 확정 전에만 보여준다. */
  const last = lastClosedRound(rounds);
  if (last?.digest) {
    const digest = last.digest;
    push(`## 근거 (AI 정리, ${last.roundNo}라운드 기준)`, "", digest.overview, "");
    if (!decision && digest.proposal) push("**AI 결론 후보**", "", digest.proposal, "");
    if (!decision && digest.consensus.length) {
      push("**의견이 모인 지점**", "");
      for (const c of digest.consensus) {
        push(`- ${c.point}`);
        if (c.basis) push(`  - 근거: ${c.basis}`);
      }
      push("");
    }
    if (digest.conflicts.length) {
      push("**의견이 갈린 지점**", "");
      for (const c of digest.conflicts) {
        push(`- ${c.topic}`);
        for (const p of c.positions) push(`  - ${namesLabel(p.who, all) || "익명"}: ${p.stance}`);
        if (c.crux) push(`  - 쟁점: ${c.crux}`);
      }
      push("");
    }
    if (digest.unresolved.length) {
      push("**정보가 부족한 지점**", "");
      for (const u of digest.unresolved) push(`- ${u.topic}${u.whyOpen ? `: ${u.whyOpen}` : ""}`);
      push("");
    }
    push(`당시 AI 의견: ${aiOpinion(digest)}`, "");
  }

  /* 진행 경과: 라운드는 표 한 줄씩 */
  if (rounds.length) {
    push("## 진행 경과", "");
    push("| 라운드 | 마감 | 답변 | 질문 | AI 판단 | 한 줄 |", "| --- | --- | --- | --- | --- | --- |");
    for (const round of rounds) {
      const when =
        round.status === "closed"
          ? formatDateTime(round.closedAt)
          : round.status === "open"
            ? "수집 중"
            : "검토 중";
      push(
        `| ${round.roundNo} | ${when} | ${round.submissions.length}명 | ${round.questions.length}개 | ${round.digest ? aiVerdict(round.digest) : ""} | ${round.digest ? cell(firstSentence(round.digest.overview)) : ""} |`,
      );
    }
    push("");
  }

  /* 배경 */
  push("## 배경", "", meeting.background.trim(), "");

  /* 부록: 질문 기준으로 묶는다. 질문 전문이 참여자 수만큼 반복되지 않게. */
  const answered = rounds.filter((r) => r.submissions.length > 0);
  if (answered.length) {
    push("## 부록: 라운드별 질문과 답변", "");
    for (const round of answered) {
      push(`### ${round.roundNo}라운드`, "");
      if (round.intro) push(quote(round.intro), "");
      round.questions.forEach((question, index) => {
        const options =
          question.kind === "choice" && question.options.length
            ? ` · ${question.options.join(" / ")}`
            : "";
        push(`**Q${index + 1}. ${question.text}** _(${questionLabel(question.kind)}${options})_`, "");
        const perQuestion = round.digest?.perQuestion.find((p) => p.questionId === question.id);
        if (perQuestion?.summary) push(`AI 요약: ${perQuestion.summary}`, "");
        for (const submission of round.submissions) {
          const answer =
            submission.answers.find((a) => a.questionId === question.id)?.value?.trim() ||
            "(무응답)";
          push(`- **${submission.participantName}**: ${answer.split("\n").join("  \n  ")}`);
        }
        push("");
      });
    }
  }

  return `${out.join("\n").trimEnd()}\n`;
}

/* ------------------------------------------------------------------ */
/* 요약 텍스트 (슬랙 · 메신저용). 마크다운 문법 없이 결론만.                */
/* ------------------------------------------------------------------ */

export function buildSummaryText(data: ReportData): string {
  const { meeting, rounds, decision } = data;
  const summary = reportSummary(data);
  const lines: string[] = [meeting.title, oneLineSummary(data), ""];

  if (decision) {
    lines.push("정해진 것");
    if (decision.decided.length === 0) lines.push("- 없음");
    decision.decided.forEach((item, index) => lines.push(`${index + 1}. ${item.point}`));
    lines.push("", "모여서 정할 것");
    if (decision.toMeet.length === 0) lines.push("- 없음. 모일 필요가 없습니다.");
    decision.toMeet.forEach((item, index) => {
      const extra = [
        item.crux ? `쟁점: ${item.crux}` : "",
        item.attendees.length ? `참석: ${namesLabel(item.attendees, summary.participants)}` : "",
      ]
        .filter(Boolean)
        .join(" / ");
      lines.push(`${index + 1}. ${item.topic}${extra ? ` (${extra})` : ""}`);
    });
    if (decision.note) lines.push("", `주최자 메모: ${decision.note}`);
    lines.push(
      "",
      `${formatDateTime(decision.decidedAt)} 확정 · 참여자 ${summary.participantCount}명 · ${summary.closedRoundCount}라운드`,
    );
  } else {
    const digest = lastDigest(rounds);
    if (digest) lines.push(digest.overview, "", `AI 의견: ${aiOpinion(digest)}`);
    lines.push("", `${summary.outcome} · 참여자 ${summary.participantCount}명 · ${summary.closedRoundCount}라운드`);
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/* ------------------------------------------------------------------ */

function quote(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

/** 표 칸에 들어갈 문장: 세로줄과 줄바꿈을 없앤다 */
function cell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
