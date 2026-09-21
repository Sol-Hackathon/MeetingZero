"use client";

import type { Question } from "@/lib/types";
import { summarize, type StatsSubmission } from "@/lib/stats";

export type { StatsSubmission };

interface Props {
  question: Question;
  submissions: StatsSubmission[];
}

/**
 * 선택형 · 5점 척도 질문의 응답 분포 막대. 서술형은 그리지 않는다.
 * 막대는 무채색만: 트랙 stone-100, 최다 stone-900, 나머지 stone-400. 선택지에 의미색을 입히지 않는다.
 */
export default function AnswerStats({ question, submissions }: Props) {
  const stats = summarize(question, submissions);
  if (!stats) return null;

  if (stats.answered === 0) {
    return (
      <p className="text-[13px] leading-5 text-stone-500">
        {submissions.length === 0 ? "아직 답변이 없습니다." : "이 질문에 답한 사람이 없습니다."}
      </p>
    );
  }

  return (
    <div>
      {question.kind === "scale" && stats.average !== null && (
        <p className="mb-2 text-[13px] leading-5 text-stone-600">
          평균{" "}
          <span className="font-semibold tabular-nums text-stone-900">{stats.average.toFixed(1)}</span>
          <span className="text-stone-400"> / 5</span>
          <span className="mx-1.5 text-stone-300">·</span>
          <span className="tabular-nums">{stats.answered}명</span>
        </p>
      )}
      <ul className="space-y-2">
        {stats.rows.map((row) => (
          <li key={row.label} className="grid grid-cols-[minmax(0,1fr)_2.5rem] items-center gap-x-3">
            <p className="truncate text-[13px] leading-5 text-stone-800" title={row.label}>
              {row.label}
            </p>
            <p className="text-right text-[13px] leading-5 tabular-nums text-stone-600">
              {row.who.length}명
            </p>
            <div className="col-span-2 h-1.5 bg-stone-100" aria-hidden>
              <div
                className={row.who.length === stats.top ? "h-full bg-stone-900" : "h-full bg-stone-400"}
                style={{ width: `${(row.who.length / stats.answered) * 100}%` }}
              />
            </div>
            {row.who.length > 0 && (
              <p className="col-span-2 text-xs leading-5 text-stone-500">{row.who.join(", ")}</p>
            )}
          </li>
        ))}
      </ul>
      {stats.skipped > 0 && (
        <p className="mt-2 text-xs leading-5 text-stone-500">
          무응답 <span className="tabular-nums">{stats.skipped}</span>명
        </p>
      )}
    </div>
  );
}
