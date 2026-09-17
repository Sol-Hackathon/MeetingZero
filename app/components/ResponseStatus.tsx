"use client";

import { useEffect, useState } from "react";
import { formatDateTime } from "@/lib/report";

interface Props {
  meetingTitle: string;
  roundNo: number;
  shareUrl: string;
  /** 주최자가 적어 둔 예상 참여자. 비어 있으면 인원 비교와 미응답자 표시는 생략 */
  expected: string[];
  /** 지금까지 제출한 사람 이름 */
  submitted: string[];
  deadlineAt: string | null;
}

/** 답변 수집 중 현황: 몇 명이 답했고, 누가 아직이고, 기한까지 얼마나 남았는지. 리마인드 문구 복사까지. */
export default function ResponseStatus({
  meetingTitle,
  roundNo,
  shareUrl,
  expected,
  submitted,
  deadlineAt,
}: Props) {
  const missing = expected.filter((name) => !submitted.some((s) => sameName(s, name)));
  const remaining = useRemaining(deadlineAt);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  async function copyReminder() {
    const lines = [
      `[${meetingTitle}] ${roundNo}라운드 답변 부탁드립니다.`,
      missing.length ? `아직 답변 전: ${missing.join(", ")}` : "",
      deadlineAt ? `기한: ${formatDateTime(deadlineAt)}${remaining ? ` (${remaining})` : ""}` : "",
      `링크: ${shareUrl}`,
      "로그인 없이 3분이면 됩니다.",
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied("copied");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 1800);
  }

  return (
    <div className="border-t border-stone-200 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-medium text-stone-900">
          답변 <span className="tabular-nums">{submitted.length}</span>
          {expected.length > 0 && (
            <span className="text-stone-500 tabular-nums"> / 예상 {expected.length}</span>
          )}
          명
          {submitted.length === 0 && (
            <span className="ml-2 font-normal text-stone-500">아직 응답이 없습니다</span>
          )}
        </p>
        {deadlineAt && (
          <p className="text-[13px] leading-5 text-stone-600 tabular-nums">
            기한 {formatDateTime(deadlineAt)}
            {remaining && (
              <span className={remaining === "지남" ? " ml-1.5 font-medium text-amber-700" : " ml-1.5"}>
                {remaining === "지남" ? "· 기한이 지났습니다" : `· ${remaining}`}
              </span>
            )}
          </p>
        )}
      </div>

      {submitted.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {submitted.map((name) => (
            <li key={name} className="chip bg-stone-100 text-stone-700">
              {name}
            </li>
          ))}
        </ul>
      )}

      {expected.length > 0 && (
        <p className="mt-3 text-[13px] leading-5 text-stone-600">
          {missing.length === 0 ? (
            <span className="font-medium text-emerald-700">예상 참여자가 모두 답했습니다.</span>
          ) : (
            <>
              <span className="font-medium text-stone-700">아직 답변 전</span>
              <span className="mx-1.5 text-stone-300">·</span>
              {missing.join(", ")}
            </>
          )}
        </p>
      )}

      {(missing.length > 0 || expected.length === 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-ghost" onClick={() => void copyReminder()}>
            {copied === "copied" ? "복사됨" : copied === "failed" ? "복사 실패" : "리마인드 문구 복사"}
          </button>
          <span className="text-xs text-stone-500">슬랙이나 메신저에 그대로 붙여 넣으세요.</span>
        </div>
      )}
    </div>
  );
}

/** "홍길동 (개발)" 과 "홍길동", "홍 길동" 을 같은 사람으로 본다. */
function normalize(name: string): string {
  return name
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function sameName(a: string, b: string): boolean {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/** 남은 시간을 1분마다 다시 계산한다. 지났으면 "지남". */
function useRemaining(deadlineAt: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadlineAt) return;
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [deadlineAt]);
  if (!deadlineAt) return null;
  const diff = new Date(deadlineAt).getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return "지남";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}분 남음`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 ${minutes % 60}분 남음`;
  const days = Math.floor(hours / 24);
  return `${days}일 ${hours % 24}시간 남음`;
}
