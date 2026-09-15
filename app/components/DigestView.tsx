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
    <div className="space-y-6">
      <p className="text-[15px] leading-relaxed text-stone-800">{digest.overview}</p>

      {/* AI 판단: 축 이름을 붙인 한 줄. 칩 두 개를 나란히 두면 모순처럼 읽힌다. */}
      <p className="text-[13px] leading-5 text-stone-600">
        <span className={digest.decisionReady ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
          결론 {digest.decisionReady ? "가능" : "미정"}
        </span>
        <span className="mx-1.5 text-stone-300">·</span>
        <span className={digest.meetingNeeded?.needed ? "font-semibold text-red-700" : "font-semibold text-stone-700"}>
          회의 {digest.meetingNeeded?.needed ? "필요" : "불필요"}
        </span>
        {digest.meetingNeeded?.reason && (
          <>
            <span className="mx-1.5 text-stone-300">·</span>
            {digest.meetingNeeded.reason}
          </>
        )}
      </p>

      {digest.consensus.length > 0 && (
        <Section title="합의된 것" tone="emerald">
          <ul className="space-y-2.5">
            {digest.consensus.map((item, index) => (
              <li key={index}>
                <p className="text-[15px] leading-relaxed text-stone-800">{item.point}</p>
                <p className="mt-0.5 text-[13px] leading-5 text-stone-500">근거 · {item.basis}</p>
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
                <p className="text-[15px] font-medium leading-relaxed text-stone-900">
                  {conflict.topic}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {conflict.positions.map((position, positionIndex) => (
                    <li key={positionIndex} className="text-[15px] leading-relaxed text-stone-700">
                      <span className="font-medium text-stone-900">
                        {position.who.join(", ") || "익명"}
                      </span>
                      <span className="mx-1.5 text-stone-300">·</span>
                      {position.stance}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[13px] leading-5 text-stone-500">쟁점 · {conflict.crux}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {digest.unresolved.length > 0 && (
        <Section title="아직 답이 안 나온 것" tone="stone">
          <ul className="space-y-2.5">
            {digest.unresolved.map((item, index) => (
              <li key={index}>
                <p className="text-[15px] leading-relaxed text-stone-800">{item.topic}</p>
                <p className="mt-0.5 text-[13px] leading-5 text-stone-500">{item.whyOpen}</p>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {digest.perQuestion.length > 0 && (
        <details className="border-t border-stone-200 pt-4">
          <summary className="cursor-pointer text-sm font-medium text-stone-700 hover:text-stone-900">
            질문별 요약
          </summary>
          <ul className="mt-4 space-y-4">
            {digest.perQuestion.map((item, index) => (
              <li key={index}>
                <p className="text-sm font-medium text-stone-900">
                  {questionById.get(item.questionId)?.text ?? `질문 #${item.questionId}`}
                </p>
                <p className="mt-1 text-[15px] leading-relaxed text-stone-700">{item.summary}</p>
                {item.notable.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {item.notable.map((note, noteIndex) => (
                      <li
                        key={noteIndex}
                        className="border-l-2 border-stone-300 pl-2.5 text-[13px] leading-5 text-stone-600"
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
  const border = {
    emerald: "border-emerald-500",
    amber: "border-amber-500",
    stone: "border-stone-300",
  }[tone];

  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-stone-900">{title}</h4>
      <div className={`border-l-[3px] pl-4 ${border}`}>{children}</div>
    </section>
  );
}
