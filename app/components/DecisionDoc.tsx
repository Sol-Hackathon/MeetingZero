"use client";

import type { Decision } from "@/lib/types";
import { namesLabel, topicKey, type Positions } from "@/lib/report";

interface Props {
  decision: Decision;
  /** 답변한 사람 전체. "참여자 전원" 축약에 쓴다 */
  all: string[];
  /** 안건별 참여자 입장 (lib/report evidenceBeyondDecision). 없으면 입장 줄을 그리지 않는다 */
  positionsByTopic?: Record<string, Positions>;
}

/**
 * 확정된 결론의 읽기 전용 렌더러. 주최자 화면(결론 카드)과 리포트가 같이 쓴다.
 * 정해진 것은 녹색, 모여서 정할 것은 호박색 왼쪽 괘선. 각 안건 밑에 누가 어떤 입장인지, 쟁점, 참석자.
 */
export default function DecisionDoc({ decision, all, positionsByTopic }: Props) {
  return (
    <div className="space-y-7">
      <div>
        <Subheading>정해진 것</Subheading>
        {decision.decided.length === 0 ? (
          <p className="text-[15px] text-stone-500">없음</p>
        ) : (
          <ol className="space-y-3 border-l-[3px] border-emerald-500 pl-4">
            {decision.decided.map((item, index) => (
              <li key={index} className="break-inside-avoid">
                <p className="text-base font-medium leading-relaxed text-stone-900">
                  <Num>{index + 1}.</Num>
                  {item.point}
                </p>
                {item.basis && <Sub>근거: {item.basis}</Sub>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <Subheading>모여서 정할 것</Subheading>
        {decision.toMeet.length === 0 ? (
          <p className="text-[15px] text-stone-700">없음. 모일 필요가 없습니다.</p>
        ) : (
          <ol className="space-y-4 border-l-[3px] border-amber-500 pl-4">
            {decision.toMeet.map((item, index) => {
              const positions = positionsByTopic?.[topicKey(item.topic)] ?? [];
              return (
                <li key={index} className="break-inside-avoid">
                  <p className="text-base font-medium leading-relaxed text-stone-900">
                    <Num>{index + 1}.</Num>
                    {item.topic}
                  </p>
                  {positions.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 text-[13px] leading-5">
                      {positions.map((position, positionIndex) => (
                        <li key={positionIndex} className="text-stone-700">
                          <span className="font-medium text-stone-900">
                            {namesLabel(position.who, all) || "익명"}
                          </span>
                          <span className="mx-1.5 text-stone-300">·</span>
                          {position.stance}
                        </li>
                      ))}
                    </ul>
                  )}
                  {item.crux && <Sub>쟁점: {item.crux}</Sub>}
                  {item.attendees.length > 0 && <Sub>참석: {namesLabel(item.attendees, all)}</Sub>}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {decision.note && (
        <div>
          <Subheading>주최자 메모</Subheading>
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-stone-800">
            {decision.note}
          </p>
        </div>
      )}
    </div>
  );
}

function Subheading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 break-after-avoid text-base font-semibold text-stone-900">{children}</h3>;
}

function Sub({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-[13px] leading-5 text-stone-600">{children}</p>;
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="mr-2 text-stone-400 tabular-nums">{children}</span>;
}
