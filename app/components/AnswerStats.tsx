"use client";

import type { Question } from "@/lib/types";

/** 주최자 화면이 받는 제출 1건. 분포 계산에 필요한 부분만 */
export interface StatsSubmission {
  participantName: string;
  answers: { questionId: number; value: string }[];
}

interface Props {
  question: Question;
  submissions: StatsSubmission[];
}

const SCALE_VALUES = [1, 2, 3, 4, 5] as const;

/** 선택형 · 5점 척도 질문의 응답 분포. 서술형은 그리지 않는다. */
export default function AnswerStats({ question, submissions }: Props) {
  if (question.kind === "open") return null;

  const picked = submissions.flatMap((submission) => {
    const value = submission.answers
      .find((a) => a.questionId === question.id)
      ?.value.trim();
    return value ? [{ who: submission.participantName, value }] : [];
  });
  const skipped = submissions.length - picked.length;

  if (picked.length === 0) {
    return (
      <p className="text-[13px] leading-5 text-stone-500">
        {submissions.length === 0
          ? "아직 답변이 없습니다."
          : "이 질문에 답한 사람이 없습니다."}
      </p>
    );
  }

  const rows =
    question.kind === "choice"
      ? choiceRows(question.options, picked)
      : scaleRows(picked);
  const max = Math.max(...rows.map((row) => row.who.length));

  return (
    <div>
      {question.kind === "scale" && (
        <p className="mb-2 text-[13px] leading-5 text-stone-600">
          평균{" "}
          <span className="font-semibold tabular-nums text-stone-900">
            {average(picked.map((p) => Number(p.value))).toFixed(1)}
          </span>
          <span className="text-stone-400"> / 5</span>
          <span className="mx-1.5 text-stone-300">·</span>
          <span className="tabular-nums">{picked.length}명</span>
        </p>
      )}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li
            key={row.label}
            className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-3"
          >
            <p
              className="truncate text-[13px] leading-5 text-stone-800"
              title={row.label}
            >
              {row.label}
            </p>
            <p className="text-right text-[13px] leading-5 tabular-nums text-stone-600">
              {row.who.length}명
            </p>
            <div className="col-span-2 h-1.5 bg-stone-100" aria-hidden>
              <div
                className={
                  row.who.length === max
                    ? "h-full bg-stone-900"
                    : "h-full bg-stone-400"
                }
                style={{ width: `${(row.who.length / picked.length) * 100}%` }}
              />
            </div>
            {row.who.length > 0 && (
              <p className="col-span-2 text-xs leading-5 text-stone-500">
                {row.who.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
      {skipped > 0 && (
        <p className="mt-2 text-xs leading-5 text-stone-500">
          무응답 <span className="tabular-nums">{skipped}</span>명
        </p>
      )}
    </div>
  );
}

interface Row {
  label: string;
  who: string[];
}

function choiceRows(
  options: string[],
  picked: { who: string; value: string }[],
): Row[] {
  const rows: Row[] = options.map((option) => ({ label: option, who: [] }));
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

function scaleRows(picked: { who: string; value: string }[]): Row[] {
  const rows: Row[] = SCALE_VALUES.map((value) => ({
    label: String(value),
    who: [],
  }));
  for (const { who, value } of picked) {
    const row = rows.find((r) => r.label === value);
    if (row) row.who.push(who);
  }
  return rows;
}

function average(values: number[]): number {
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0) return 0;
  return valid.reduce((sum, v) => sum + v, 0) / valid.length;
}
