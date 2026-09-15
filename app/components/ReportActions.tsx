"use client";

import { useState } from "react";

interface Props {
  meetingId: string;
  hostToken: string;
  /** 리포트 화면 안에서는 "리포트 보기" 링크를 숨긴다 */
  hideViewLink?: boolean;
}

/** 리포트 보기 · 마크다운 복사 버튼 */
export default function ReportActions({ meetingId, hostToken, hideViewLink }: Props) {
  const [state, setState] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  const query = `t=${encodeURIComponent(hostToken)}`;

  async function copyMarkdown() {
    setState("copying");
    try {
      const response = await fetch(`/api/meetings/${meetingId}/report?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("report failed");
      await navigator.clipboard.writeText(await response.text());
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1800);
  }

  const copyLabel = {
    idle: "마크다운 복사",
    copying: "복사 중…",
    copied: "복사됨",
    failed: "복사 실패",
  }[state];

  return (
    <div className="flex flex-wrap gap-2">
      {!hideViewLink && (
        <a
          className="btn-ghost"
          href={`/m/${meetingId}/report?${query}`}
          target="_blank"
          rel="noreferrer"
        >
          리포트 보기
        </a>
      )}
      <button
        type="button"
        className="btn-ghost"
        disabled={state === "copying"}
        onClick={() => void copyMarkdown()}
      >
        {copyLabel}
      </button>
    </div>
  );
}
