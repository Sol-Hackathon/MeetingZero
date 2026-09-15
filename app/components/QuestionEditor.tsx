"use client";

import type { DraftQuestion, QuestionKind } from "@/lib/types";

const KIND_LABEL: Record<QuestionKind, string> = {
  open: "서술형",
  choice: "선택형",
  scale: "5점 척도",
};

export function kindLabel(kind: QuestionKind) {
  return KIND_LABEL[kind] ?? kind;
}

interface Props {
  questions: DraftQuestion[];
  onChange: (questions: DraftQuestion[]) => void;
}

/** 주최자가 AI 초안 질문을 검토·수정하는 편집기 */
export default function QuestionEditor({ questions, onChange }: Props) {
  function update(index: number, patch: Partial<DraftQuestion>) {
    onChange(questions.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    const next = [...questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function remove(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function add() {
    onChange([
      ...questions,
      { text: "", intent: "", kind: "open", options: [], required: true },
    ]);
  }

  return (
    <div className="space-y-3">
      {questions.map((question, index) => (
        <div key={index} className="rounded-md border border-stone-200 bg-stone-50 p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="font-display text-base font-semibold text-stone-500 tabular-nums">
              Q{index + 1}
            </span>
            <select
              className="rounded-sm border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-900"
              value={question.kind}
              onChange={(e) => {
                const kind = e.target.value as QuestionKind;
                const options =
                  kind !== "choice"
                    ? []
                    : question.options.length > 0
                      ? question.options
                      : ["", ""];
                update(index, { kind, options });
              }}
            >
              {(Object.keys(KIND_LABEL) as QuestionKind[]).map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_LABEL[kind]}
                </option>
              ))}
            </select>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-stone-600">
              <input
                type="checkbox"
                className="accent-emerald-600"
                checked={question.required}
                onChange={(e) => update(index, { required: e.target.checked })}
              />
              필수
            </label>
            <div className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                className="btn-quiet"
                aria-label="위로"
                onClick={() => move(index, -1)}
              >
                ↑
              </button>
              <button
                type="button"
                className="btn-quiet"
                aria-label="아래로"
                onClick={() => move(index, 1)}
              >
                ↓
              </button>
              <button
                type="button"
                className="btn-quiet hover:!bg-red-50 hover:!text-red-700"
                onClick={() => remove(index)}
              >
                삭제
              </button>
            </div>
          </div>

          <textarea
            className="input min-h-[64px] resize-y"
            placeholder="참여자에게 보여줄 질문"
            value={question.text}
            onChange={(e) => update(index, { text: e.target.value })}
          />

          {question.kind === "choice" && (
            <div className="mt-2 space-y-1.5">
              {question.options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <span className="w-4 text-center text-xs text-stone-400 tabular-nums">
                    {optionIndex + 1}
                  </span>
                  <input
                    className="input py-1.5 text-sm"
                    value={option}
                    placeholder="선택지"
                    onChange={(e) =>
                      update(index, {
                        options: question.options.map((o, i) =>
                          i === optionIndex ? e.target.value : o,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="btn-quiet"
                    aria-label="선택지 삭제"
                    onClick={() =>
                      update(index, {
                        options: question.options.filter((_, i) => i !== optionIndex),
                      })
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-quiet"
                onClick={() => update(index, { options: [...question.options, ""] })}
              >
                + 선택지 추가
              </button>
            </div>
          )}

          <div className="mt-2 flex items-start gap-2">
            <span className="mt-2 shrink-0 text-[11px] font-medium text-stone-500">의도</span>
            <input
              className="input border-dashed py-1.5 text-xs text-stone-600"
              placeholder="이 질문으로 무엇을 확정하려는지 (참여자에게는 안 보입니다)"
              value={question.intent}
              onChange={(e) => update(index, { intent: e.target.value })}
            />
          </div>
        </div>
      ))}

      <button type="button" className="btn-ghost w-full border-dashed" onClick={add}>
        + 질문 직접 추가
      </button>
    </div>
  );
}
