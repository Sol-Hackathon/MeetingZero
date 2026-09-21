import type { Decision, MeetingStatus, QuestionKind, Round, RoundDigest } from "./types";
import { statsLine, summarize } from "./stats";

/*
 * 리포트 데이터와 문서를 만드는 순수 함수. DB 나 API 에 의존하지 않는다.
 * 서버(마크다운 · 요약 API)와 클라이언트(인쇄용 화면)가 같은 순서, 같은 문구를 쓴다.
 *
 * 문서 순서는 독자가 묻는 순서를 따른다.
 *   결론(뭐가 정해졌나) → 근거(왜) → 진행 경과(어떻게) → 배경 → 부록(원자료)
 * 결론은 마지막 라운드 정리에서 나온 것이므로, 근거에는 결론에 이미 옮겨진 안건을 다시 적지 않는다.
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
const timeOnly = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDateTime(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? dateTime.format(date) : "";
}

export function formatDate(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? dateOnly.format(date) : "";
}

/** "09-21 13:29". 같은 문서 안에서 연도가 반복되지 않게 */
export function formatShort(iso: string | null | undefined): string {
  const date = parse(iso);
  return date ? dateTime.format(date).slice(5) : "";
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

/* ------------------------------------------------------------------ */
/* AI 판단                                                              */
/* ------------------------------------------------------------------ */

export type VerdictTone = "red" | "emerald" | "amber";

/**
 * AI 판단을 한 단어로. 두 축(결론 가능 여부 · 회의 필요 여부)을 나란히 두면 모순처럼 읽혀서,
 * 우선순위대로 하나만 고른다: 모여야 함 > 결론 가능 > 다음 라운드로.
 */
export function aiVerdict(digest: RoundDigest): string {
  if (digest.meetingNeeded.needed) return "모여야 함";
  if (digest.decisionReady) return "결론 가능";
  return "다음 라운드로";
}

export function verdictTone(digest: RoundDigest): VerdictTone {
  if (digest.meetingNeeded.needed) return "red";
  if (digest.decisionReady) return "emerald";
  return "amber";
}

/** AI 의견 한 문장 (판단 + 이유) */
export function aiOpinion(digest: RoundDigest): string {
  const reason = digest.meetingNeeded.reason.trim();
  return reason ? `${aiVerdict(digest)}. ${reason}` : aiVerdict(digest);
}

/** 라운드 정리의 건수. 접힌 라운드 요약 줄과 진행 경과가 같이 쓴다. */
export function digestCounts(digest: RoundDigest): {
  consensus: number;
  conflicts: number;
  unresolved: number;
} {
  return {
    consensus: digest.consensus.length,
    conflicts: digest.conflicts.length,
    unresolved: digest.unresolved.length,
  };
}

/** "답변 4명 · 09-21 13:29 마감 · 합의 1 · 갈림 1 · 미해결 3 · 결론 가능" */
export function roundMetaLine(round: ReportRound): string {
  const when =
    round.status === "closed"
      ? `${formatShort(round.closedAt)} 마감`
      : round.status === "open"
        ? "답변 수집 중"
        : "주최자 검토 중";
  const parts = [`답변 ${round.submissions.length}명`, when];
  if (round.digest) {
    const c = digestCounts(round.digest);
    parts.push(`합의 ${c.consensus} · 갈림 ${c.conflicts} · 미해결 ${c.unresolved}`, aiVerdict(round.digest));
  }
  return parts.join(" · ");
}

/* ------------------------------------------------------------------ */
/* 결론 요약                                                             */
/* ------------------------------------------------------------------ */

/** 리포트 맨 위 한 줄. 건수만 말한다. 안건 제목은 바로 아래 목록에 있다. */
export function oneLineSummary(data: ReportData): string {
  const { decision, rounds } = data;
  if (decision) {
    const decided = decision.decided.length;
    const toMeet = decision.toMeet.length;
    if (toMeet === 0) return `정해진 것 ${decided}건. 모일 필요 없이 마무리했습니다.`;
    return `정해진 것 ${decided}건, 모여서 정할 것 ${toMeet}건이 남았습니다.`;
  }
  const digest = lastDigest(rounds);
  if (!digest) return "아직 마감된 라운드가 없습니다.";
  return `아직 확정 전입니다. AI 의견은 "${aiVerdict(digest)}"입니다.`;
}

/**
 * "참석 필요 · 이름들". 모여서 정할 것 전 항목에 참석자가 지정됐을 때만.
 * 일부만 지정됐으면 합집합이 "이 사람들만 오면 된다"로 읽혀 오도하므로 생략.
 */
export function attendeesFact(decision: Decision | null, all: string[]): string | null {
  if (!decision || decision.toMeet.length === 0) return null;
  if (!decision.toMeet.every((item) => item.attendees.length > 0)) return null;
  const names = unique(decision.toMeet.flatMap((item) => item.attendees));
  const label = namesLabel(names, all);
  return label ? label : null;
}

/** 머리말에 쓰는 요약 수치와 상태 문구 */
export function reportSummary(data: ReportData) {
  const { meeting, rounds, decision } = data;
  const participants = participantNames(rounds);
  const closed = rounds.filter((r) => r.status === "closed");
  const lastClosedAt = closed.length ? closed[closed.length - 1].closedAt : null;
  const end = decision?.decidedAt ?? lastClosedAt;
  const start = formatDate(meeting.createdAt);
  const endDate = end ? formatDate(end) : "";
  const period = endDate && endDate !== start ? `${start} ~ ${endDate}` : start;

  const outcome = decision
    ? `결론 확정 (${formatDateTime(decision.decidedAt)})`
    : meeting.status === "deciding"
      ? "결정 대기"
      : meeting.status === "collecting"
        ? "답변 수집 중"
        : meeting.status === "draft"
          ? "준비 중"
          : "종료 (결론 미기록)";

  // 기간 줄 옆에 붙일 짧은 상태. 확정일이 기간의 끝과 같으면 시각만 적어 날짜가 두 번 나오지 않게.
  const decidedDate = parse(decision?.decidedAt);
  const outcomeShort = decision
    ? `결론 확정 ${
        decidedDate && formatDate(decision.decidedAt) === endDate
          ? timeOnly.format(decidedDate)
          : formatDateTime(decision.decidedAt)
      }`
    : outcome;

  return {
    participants,
    participantCount: participants.length,
    closedRoundCount: closed.length,
    period,
    outcome,
    outcomeShort,
    /** "2026-09-21 · 2라운드 · 결론 확정 13:30" */
    metaLine: `${period} · ${closed.length}라운드 · ${outcomeShort}`,
  };
}

/* ------------------------------------------------------------------ */
/* 근거: 결론과 겹치지 않는 부분만                                        */
/* ------------------------------------------------------------------ */

export type Positions = { stance: string; who: string[] }[];

export interface Evidence {
  /** 결론의 "모여서 정할 것"으로 옮겨지지 않은 갈린 안건 */
  conflicts: RoundDigest["conflicts"];
  /** 결론으로 옮겨지지 않은 미해결 */
  unresolved: RoundDigest["unresolved"];
  /** 안건별 참여자 입장. 결론 항목 밑에 붙인다. 키는 topicKey() */
  positionsByTopic: Record<string, Positions>;
}

/** 제목 비교용 키. 공백과 대소문자 차이는 같은 안건으로 본다. */
export function topicKey(topic: string): string {
  return topic.replace(/\s+/g, "").toLowerCase();
}

/**
 * 결론 초안은 마지막 정리의 갈림 · 미해결을 그대로 옮기므로, 근거에 같은 문장을 또 적으면 두 번 읽게 된다.
 * 결론에 있는 안건은 근거에서 빼고, 그 안건의 참여자 입장은 결론 항목 밑으로 보낸다.
 * 주최자가 제목을 고쳐 쓰면 매칭이 안 돼 근거에 남으므로 정보가 사라지지는 않는다.
 */
export function evidenceBeyondDecision(digest: RoundDigest, decision: Decision | null): Evidence {
  const positionsByTopic: Record<string, Positions> = {};
  for (const c of digest.conflicts) positionsByTopic[topicKey(c.topic)] = c.positions;
  if (!decision) {
    return { conflicts: digest.conflicts, unresolved: digest.unresolved, positionsByTopic };
  }
  const inDecision = new Set(decision.toMeet.map((item) => topicKey(item.topic)));
  // 주최자 선택으로 정해진 것에 들어간 갈림도 결론에 있는 셈이다.
  const picked = (topic: string) =>
    decision.decided.some((d) => d.point.startsWith(`[주최자 선택] ${topic}:`));
  return {
    conflicts: digest.conflicts.filter((c) => !inDecision.has(topicKey(c.topic)) && !picked(c.topic)),
    unresolved: digest.unresolved.filter((u) => !inDecision.has(topicKey(u.topic))),
    positionsByTopic,
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
  push(`${summary.period} · ${summary.closedRoundCount}라운드 · 참여자 ${summary.participantCount}명 · ${summary.outcome}`);
  if (meeting.goal) push("", `목표: ${meeting.goal}`);
  push("");

  const last = lastClosedRound(rounds);
  const evidence = last?.digest ? evidenceBeyondDecision(last.digest, decision) : null;

  /* 결론 */
  push("## 결론", "", `**${oneLineSummary(data)}**`, "");
  if (decision) {
    const attendees = attendeesFact(decision, all);
    if (attendees) push(`참석 필요 · ${attendees}`, "");
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
      const positions = evidence?.positionsByTopic[topicKey(item.topic)];
      if (positions?.length) {
        push("   - 입장");
        for (const p of positions) push(`     - ${namesLabel(p.who, all) || "익명"}: ${p.stance}`);
      }
      if (item.crux) push(`   - 쟁점: ${item.crux}`);
      if (item.attendees.length) push(`   - 참석: ${namesLabel(item.attendees, all)}`);
    });
    if (decision.note) push("", "### 주최자 메모", "", decision.note);
    push("");
  } else {
    push("아직 확정되지 않았습니다.", "");
  }

  /* 근거: 마지막 라운드의 AI 정리 중 결론에 없는 것 */
  if (last?.digest && evidence) {
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
    if (evidence.conflicts.length) {
      push("**의견이 갈린 지점**", "");
      for (const c of evidence.conflicts) {
        push(`- ${c.topic}`);
        for (const p of c.positions) push(`  - ${namesLabel(p.who, all) || "익명"}: ${p.stance}`);
        if (c.crux) push(`  - 쟁점: ${c.crux}`);
      }
      push("");
    }
    if (evidence.unresolved.length) {
      push("**정보가 부족한 지점**", "");
      for (const u of evidence.unresolved) push(`- ${u.topic}${u.whyOpen ? `: ${u.whyOpen}` : ""}`);
      push("");
    }
    push(`당시 AI 의견: ${aiOpinion(digest)}`, "");
  }

  /* 진행 경과: 라운드마다 두 줄 */
  if (rounds.length) {
    push("## 진행 경과", "");
    for (const round of rounds) {
      push(`- **${round.roundNo}라운드** · ${roundMetaLine(round)}`);
      if (round.digest) push(`  ${firstSentence(round.digest.overview)}`);
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
        const stats = summarize(question, round.submissions);
        if (stats && stats.answered > 0) push(`분포: ${statsLine(question, stats)}`, "");
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
  const lines: string[] = [meeting.title];

  if (decision) {
    lines.push(
      `정해진 것 ${decision.decided.length}건 · 모여서 정할 것 ${decision.toMeet.length}건 · 참여자 ${summary.participantCount}명 · ${summary.closedRoundCount}라운드 · ${formatDate(decision.decidedAt)} 확정`,
      "",
    );
    const attendees = attendeesFact(decision, summary.participants);
    if (attendees) lines.push(`참석 필요 — ${attendees}`, "");
    lines.push(`정해진 것 (${decision.decided.length})`);
    if (decision.decided.length === 0) lines.push("- 없음");
    decision.decided.forEach((item, index) => lines.push(`${index + 1}. ${item.point}`));
    lines.push("", `모여서 정할 것 (${decision.toMeet.length})`);
    if (decision.toMeet.length === 0) lines.push("- 없음. 모일 필요가 없습니다.");
    decision.toMeet.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.topic}`);
      if (item.crux) lines.push(` 쟁점 — ${item.crux}`);
      if (item.attendees.length) lines.push(` 참석 — ${namesLabel(item.attendees, summary.participants)}`);
    });
    if (decision.note) lines.push("", `주최자 메모 — ${decision.note}`);
  } else {
    lines.push(`${summary.outcome} · 참여자 ${summary.participantCount}명 · ${summary.closedRoundCount}라운드`, "");
    const digest = lastDigest(rounds);
    if (digest) lines.push(digest.overview, "", `AI 의견 — ${aiOpinion(digest)}`);
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

function unique(list: string[]): string[] {
  return Array.from(new Set(list.map((s) => s.trim()).filter(Boolean)));
}
