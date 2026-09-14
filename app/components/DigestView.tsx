"use client";

import type { Question, RoundDigest } from "@/lib/types";

interface Props {
  digest: RoundDigest;
  questions: Question[];
}

/** 한 라운드 답변을 AI가 정리한 결과 */
export default function DigestView({ digest, questions }: Props) {
  const questionById = new Map(questions.map((q) => [q.id, q]));

  return (
    <div className="space-y-5">
      <p className="rounded-lg bg-stone-100 p-4 text-[15px] leading-relaxed text-stone-800">
        {digest.overview}
      </p>

      <div className="flex flex-wrap gap-2">
        <span
          className={
            digest.decisionReady
              ? "chip bg-emerald-100 text-emerald-800"
              : "chip bg-amber-100 text-amber-800"
          }
        >
          {digest.decisionReady ? "결론 가능" : "쟁점 남음"}
        </span>
        <span
          className={
            digest.meetingNeeded?.needed
              ? "chip bg-red-100 text-red-800"
              : "chip bg-emerald-100 text-emerald-800"
          }
        >
          {digest.meetingNeeded?.needed ? "실제 회의 권장" : "회의 불필요"}
        </span>
      </div>
      {digest.meetingNeeded?.reason && (
        <p className="-mt-3 text-sm text-stone-500">{digest.meetingNeeded.reason}</p>
      )}

      {digest.consensus.length > 0 && (
        <Section title="합의된 것" tone="emerald">
          <ul className="space-y-2">
            {digest.consensus.map((item, index) => (
              <li key={index}>
                <p className="text-[15px] text-stone-800">{item.point}</p>
                <p className="mt-0.5 text-xs text-stone-500">근거 · {item.basis}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {digest.conflicts.length > 0 && (
        <Section title="의견이 갈린 것" tone="amber">
          <ul className="space-y-4">
            {digest.conflicts.map((conflict, index) => (
              <li key={index}>
                <p className="font-medium text-stone-900">{conflict.topic}</p>
                <div className="mt-1.5 space-y-1">
                  {conflict.positions.map((position, positionIndex) => (
                    <div key={positionIndex} className="flex gap-2 text-sm">
                      <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-xs text-stone-500 ring-1 ring-stone-200">
                        {position.who.join(", ") || "익명"}
                      </span>
                      <span className="text-stone-700">{position.stance}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-stone-500">쟁점 · {conflict.crux}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {digest.unresolved.length > 0 && (
        <Section title="아직 답이 안 나온 것" tone="stone">
          <ul className="space-y-2">
            {digest.unresolved.map((item, index) => (
              <li key={index}>
                <p className="text-[15px] text-stone-800">{item.topic}</p>
                <p className="mt-0.5 text-xs text-stone-500">{item.whyOpen}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {digest.perQuestion.length > 0 && (
        <details className="rounded-lg border border-stone-200">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-stone-700">
            질문별 요약
          </summary>
          <ul className="space-y-4 border-t border-stone-200 px-4 py-4">
            {digest.perQuestion.map((item, index) => (
              <li key={index}>
                <p className="text-sm font-medium text-stone-900">
                  {questionById.get(item.questionId)?.text ?? `질문 #${item.questionId}`}
                </p>
                <p className="mt-1 text-sm text-stone-700">{item.summary}</p>
                {item.notable.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {item.notable.map((note, noteIndex) => (
                      <li
                        key={noteIndex}
                        className="border-l-2 border-stone-300 pl-2 text-xs text-stone-500"
                      >
                        {note}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "emerald" | "amber" | "stone";
  children: React.ReactNode;
}) {
  const bar = {
    emerald: "bg-emerald-400",
    amber: "bg-amber-400",
    stone: "bg-stone-300",
  }[tone];

  return (
    <section>
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-900">
        <span className={`h-3.5 w-1 rounded-full ${bar}`} />
        {title}
      </h4>
      <div className="pl-3">{children}</div>
    </section>
  );
}
