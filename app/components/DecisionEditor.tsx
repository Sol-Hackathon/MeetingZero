"use client";

import { useEffect, useState } from "react";
import type { Decision, RoundDigest } from "@/lib/types";
import { draftDecision, type DecisionInput } from "@/lib/decision";
import { formatDateTime } from "@/lib/report";

interface Props {
  /** 확정된 결론. 없으면 초안 편집 상태로 시작한다 */
  decision: Decision | null;
  /** 초안을 채울 라운드별 정리 결과 (라운드 순서대로) */
  digests: RoundDigest[];
  /** 참석자 후보 (답변한 사람들) */
  participantNames: string[];
  busy: boolean;
  onSave: (input: DecisionInput) => Promise<unknown>;
}

/** 회의를 끝내면서 "정해진 것 / 모여서 정할 것"을 기록하는 카드 */
export default function DecisionEditor({
  decision,
  digests,
  participantNames,
  busy,
  onSave,
}: Props) {
  const [editing, setEditing] = useState(decision === null);
  const [draft, setDraft] = useState<DecisionInput>(() =>
    decision ? toInput(decision) : draftDecision(digests),
  );

  // 확정이 끝나면(서버 상태가 바뀌면) 읽기 모드로 돌아간다.
  const decidedAt = decision?.decidedAt ?? null;
  useEffect(() => {
    if (decision) {
      setDraft(toInput(decision));
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decidedAt]);

  return (
    <section className="card p-6 sm:p-7">
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-xl font-semibold text-stone-900">결론</h2>
        <span className={decision ? "status status-done" : "status status-wait"}>
          {decision ? "확정됨" : "결정 대기"}
        </span>
      </div>

      {decision && !editing ? (
        <div className="space-y-5">
          <DecisionSummary decision={decision} />
          <div className="flex items-center justify-between">
            <p className="text-xs text-stone-400">{formatDateTime(decision.decidedAt)} 확정</p>
            <button type="button" className="btn-quiet" onClick={() => setEditing(true)}>
              결정 수정
            </button>
          </div>
        </div>
      ) : (
        <Editor
          draft={draft}
          onChange={setDraft}
          participantNames={participantNames}
          isNew={decision === null}
          busy={busy}
          onSave={() => void onSave(draft)}
          onCancel={
            decision
              ? () => {
                  setDraft(toInput(decision));
                  setEditing(false);
                }
              : null
          }
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Editor({
  draft,
  onChange,
  participantNames,
  isNew,
  busy,
  onSave,
  onCancel,
}: {
  draft: DecisionInput;
  onChange: (next: DecisionInput) => void;
  participantNames: string[];
  isNew: boolean;
  busy: boolean;
  onSave: () => void;
  onCancel: (() => void) | null;
}) {
  const attendeeChoices = Array.from(
    new Set([...participantNames, ...draft.toMeet.flatMap((t) => t.attendees)]),
  );

  function updateDecided(index: number, patch: Partial<DecisionInput["decided"][number]>) {
    onChange({
      ...draft,
      decided: draft.decided.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    });
  }

  function updateToMeet(index: number, patch: Partial<DecisionInput["toMeet"][number]>) {
    onChange({
      ...draft,
      toMeet: draft.toMeet.map((t, i) => (i === index ? { ...t, ...patch } : t)),
    });
  }

  function toggleAttendee(index: number, name: string) {
    const item = draft.toMeet[index];
    const attendees = item.attendees.includes(name)
      ? item.attendees.filter((n) => n !== name)
      : [...item.attendees, name];
    updateToMeet(index, { attendees });
  }

  return (
    <div className="space-y-6">
      {isNew && (
        <p className="text-sm text-stone-600">
          답변이 모두 모였습니다. 마지막 정리 결과로 초안을 채웠습니다. 고치거나 빼고 확정하세요.
          확정하면 회의가 종료됩니다.
        </p>
      )}

      <div>
        <Heading tone="emerald">정해진 것</Heading>
        <div className="space-y-2">
          {draft.decided.map((item, index) => (
            <div key={index} className="rounded-lg border border-stone-200 bg-stone-50/60 p-3">
              <div className="flex items-start gap-2">
                <textarea
                  className="input min-h-[44px] resize-y bg-white text-sm leading-relaxed"
                  placeholder="정해진 것"
                  value={item.point}
                  onChange={(e) => updateDecided(index, { point: e.target.value })}
                />
                <button
                  type="button"
                  className="btn-quiet shrink-0 hover:!bg-red-50 hover:!text-red-600"
                  onClick={() =>
                    onChange({ ...draft, decided: draft.decided.filter((_, i) => i !== index) })
                  }
                >
                  삭제
                </button>
              </div>
              <input
                className="input mt-2 border-dashed bg-white py-1.5 text-xs text-stone-600"
                placeholder="근거 (누가 어떤 말을 했는지)"
                value={item.basis}
                onChange={(e) => updateDecided(index, { basis: e.target.value })}
              />
            </div>
          ))}
          {draft.decided.length === 0 && (
            <p className="text-sm text-stone-400">아직 없습니다.</p>
          )}
          <button
            type="button"
            className="btn-ghost w-full border-dashed"
            onClick={() =>
              onChange({ ...draft, decided: [...draft.decided, { point: "", basis: "" }] })
            }
          >
            + 추가
          </button>
        </div>
      </div>

      <div>
        <Heading tone="amber">모여서 정할 것</Heading>
        <p className="mb-2 text-xs text-stone-500">
          여기 남은 것만 실제 회의 안건이 됩니다. 비어 있으면 모일 필요가 없다는 뜻입니다.
        </p>
        <div className="space-y-2">
          {draft.toMeet.map((item, index) => (
            <div key={index} className="rounded-lg border border-stone-200 bg-stone-50/60 p-3">
              <div className="flex items-start gap-2">
                <textarea
                  className="input min-h-[44px] resize-y bg-white text-sm leading-relaxed"
                  placeholder="모여서 정할 것"
                  value={item.topic}
                  onChange={(e) => updateToMeet(index, { topic: e.target.value })}
                />
                <button
                  type="button"
                  className="btn-quiet shrink-0 hover:!bg-red-50 hover:!text-red-600"
                  onClick={() =>
                    onChange({ ...draft, toMeet: draft.toMeet.filter((_, i) => i !== index) })
                  }
                >
                  삭제
                </button>
              </div>
              <input
                className="input mt-2 border-dashed bg-white py-1.5 text-xs text-stone-600"
                placeholder="쟁점 한 줄 (무엇이 갈리는지)"
                value={item.crux}
                onChange={(e) => updateToMeet(index, { crux: e.target.value })}
              />
              {attendeeChoices.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-stone-400">참석</span>
                  {attendeeChoices.map((name) => {
                    const on = item.attendees.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleAttendee(index, name)}
                        className={`chip border transition ${
                          on
                            ? "border-stone-900 bg-stone-900 text-white"
                            : "border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
                        }`}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          {draft.toMeet.length === 0 && (
            <p className="text-sm text-stone-400">없음. 모일 필요가 없습니다.</p>
          )}
          <button
            type="button"
            className="btn-ghost w-full border-dashed"
            onClick={() =>
              onChange({
                ...draft,
                toMeet: [...draft.toMeet, { topic: "", crux: "", attendees: [] }],
              })
            }
          >
            + 추가
          </button>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="decision-note">
          메모 <span className="font-normal text-stone-400">(선택)</span>
        </label>
        <textarea
          id="decision-note"
          className="input mt-1.5 min-h-[72px] resize-y text-sm leading-relaxed"
          placeholder="결정 배경, 다음 할 일, 회의 일정 등"
          value={draft.note}
          onChange={(e) => onChange({ ...draft, note: e.target.value })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" disabled={busy} onClick={onSave}>
          {busy ? "저장 중…" : isNew ? "결론 확정하고 회의 마치기" : "저장"}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" disabled={busy} onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** 확정된 결론을 읽기 전용으로. 주최자 화면과 리포트 화면이 같이 쓴다. */
export function DecisionSummary({ decision }: { decision: Decision }) {
  return (
    <div className="space-y-5">
      <div>
        <Heading tone="emerald">정해진 것</Heading>
        {decision.decided.length === 0 ? (
          <p className="pl-3 text-sm text-stone-400">없음</p>
        ) : (
          <ul className="space-y-2 pl-3">
            {decision.decided.map((item, index) => (
              <li key={index}>
                <p className="text-[15px] text-stone-800">{item.point}</p>
                {item.basis && <p className="mt-0.5 text-xs text-stone-500">근거 · {item.basis}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <Heading tone="amber">모여서 정할 것</Heading>
        {decision.toMeet.length === 0 ? (
          <p className="pl-3 text-sm text-stone-600">없음. 모일 필요가 없습니다.</p>
        ) : (
          <ul className="space-y-3 pl-3">
            {decision.toMeet.map((item, index) => (
              <li key={index}>
                <p className="text-[15px] font-medium text-stone-900">{item.topic}</p>
                {item.crux && <p className="mt-0.5 text-xs text-stone-500">쟁점 · {item.crux}</p>}
                {item.attendees.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.attendees.map((name) => (
                      <span key={name} className="chip bg-stone-100 text-stone-700">
                        {name}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {decision.note && (
        <div>
          <Heading tone="stone">메모</Heading>
          <p className="whitespace-pre-wrap pl-3 text-sm text-stone-700">{decision.note}</p>
        </div>
      )}
    </div>
  );
}

function Heading({
  tone,
  children,
}: {
  tone: "emerald" | "amber" | "stone";
  children: React.ReactNode;
}) {
  const bar = { emerald: "bg-emerald-400", amber: "bg-amber-400", stone: "bg-stone-300" }[tone];
  return (
    <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-stone-900">
      <span className={`h-3.5 w-1 rounded-full ${bar}`} />
      {children}
    </h3>
  );
}

function toInput(decision: Decision): DecisionInput {
  return {
    decided: decision.decided.map((d) => ({ ...d })),
    toMeet: decision.toMeet.map((t) => ({ ...t, attendees: [...t.attendees] })),
    note: decision.note,
  };
}
