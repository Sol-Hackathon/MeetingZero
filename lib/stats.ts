import type { Question } from "./types";

/*
 * 선택형 · 5점 척도 답변의 분포 집계. React 없이 순수 함수만 둔다.
 * 주최자 화면의 막대(AnswerStats), 수집 중 카드의 한 줄 요약, 리포트 부록, 마크다운 "분포:" 줄이 같이 쓴다.
 */

/** 분포 계산에 필요한 제출 1건 */
export interface StatsSubmission {
  participantName: string;
  answers: { questionId: number; value: string }[];
}

export interface StatRow {
  label: string;
  who: string[];
}

export interface QuestionStats {
  rows: StatRow[];
  /** 이 질문에 값을 낸 사람 수 */
  answered: number;
  /** 제출은 했지만 이 질문은 비운 사람 수 */
  skipped: number;
  /** 최다 선택지의 인원. 최다가 둘 이상이면 -1 (강조할 것이 없음) */
  top: number;
  /** 척도 질문의 평균. 선택형은 null */
  average: number | null;
}

const SCALE_VALUES = [1, 2, 3, 4, 5] as const;

export function pickedAnswers(
  question: Question,
  submissions: StatsSubmission[],
): { who: string; value: string }[] {
  return submissions.flatMap((submission) => {
    const value = submission.answers.find((a) => a.questionId === question.id)?.value.trim();
    return value ? [{ who: submission.participantName, value }] : [];
  });
}

/** 서술형이면 null */
export function summarize(question: Question, submissions: StatsSubmission[]): QuestionStats | null {
  if (question.kind === "open") return null;
  const picked = pickedAnswers(question, submissions);
  const rows = question.kind === "choice" ? choiceRows(question.options, picked) : scaleRows(picked);
  const max = Math.max(0, ...rows.map((row) => row.who.length));
  const top = max > 0 && rows.filter((row) => row.who.length === max).length === 1 ? max : -1;
  const average =
    question.kind === "scale" && picked.length
      ? picked.reduce((sum, p) => sum + Number(p.value), 0) / picked.length
      : null;
  return { rows, answered: picked.length, skipped: submissions.length - picked.length, top, average };
}

/**
 * 한 줄 요약. 선택형 "찬성 2 · 반대 1 · 보류 1", 척도 "평균 3.2 / 5 · 2:1 · 3:2 · 4:1".
 * 아무도 안 고른 선택지는 뺀다 (한 줄에는 있는 것만).
 */
export function statsLine(question: Question, stats: QuestionStats): string {
  if (stats.answered === 0) return "답변 없음";
  const parts = stats.rows.filter((row) => row.who.length > 0);
  if (question.kind === "scale") {
    const dist = parts.map((row) => `${row.label}:${row.who.length}`).join(" · ");
    return `평균 ${(stats.average ?? 0).toFixed(1)} / 5 · ${dist}`;
  }
  return parts.map((row) => `${row.label} ${row.who.length}`).join(" · ");
}

function choiceRows(options: string[], picked: { who: string; value: string }[]): StatRow[] {
  const rows: StatRow[] = options.map((option) => ({ label: option, who: [] }));
  const byLabel = new Map(rows.map((row) => [row.label, row]));
  for (const { who, value } of picked) {
    // 선택지가 나중에 바뀌어 목록에 없는 값이 있으면 따로 한 줄로 보여준다.
    let row = byLabel.get(value);
    if (!row) {
      row = { label: value, who: [] };
      byLabel.set(value, row);
      rows.push(row);
    }
    row.who.push(who);
  }
  return rows;
}

function scaleRows(picked: { who: string; value: string }[]): StatRow[] {
  const rows: StatRow[] = SCALE_VALUES.map((value) => ({ label: String(value), who: [] }));
  for (const { who, value } of picked) {
    const row = rows.find((r) => r.label === value);
    if (row) row.who.push(who);
  }
  return rows;
}
