"use client";

import { useState } from "react";

interface Props {
  meetingId: string;
  hostToken: string;
  /** 리포트 화면 안에서는 "리포트 보기" 링크를 숨긴다 */
  hideViewLink?: boolean;
}

type Format = "markdown" | "summary";
type CopyState = "copying" | "copied" | "failed";

/**
 * 리포트 보기 · 마크다운 복사 · 요약 복사.
 * 마크다운은 GitHub · 노션용 전문, 요약은 슬랙 · 메신저에 붙일 결론만 담은 일반 텍스트.
 */
export default function ReportActions({ meetingId, hostToken, hideViewLink }: Props) {
  const [copy, setCopy] = useState<{ format: Format; state: CopyState } | null>(null);
  const query = `t=${encodeURIComponent(hostToken)}`;

  async function copyReport(format: Format) {
    setCopy({ format, state: "copying" });
    try {
      const response = await fetch(
        `/api/meetings/${meetingId}/report?${query}${format === "summary" ? "&format=summary" : ""}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("report failed");
      await navigator.clipboard.writeText(await response.text());
      setCopy({ format, state: "copied" });
    } catch {
      setCopy({ format, state: "failed" });
    }
    setTimeout(() => setCopy(null), 1800);
  }

  function label(format: Format, idle: string) {
    if (copy?.format !== format) return idle;
    return { copying: "복사 중…", copied: "복사됨", failed: "복사 실패" }[copy.state];
  }

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
        title="GitHub · 노션에 붙여 넣는 전문"
        disabled={copy?.state === "copying"}
        onClick={() => void copyReport("markdown")}
      >
        {label("markdown", "마크다운 복사")}
      </button>
      <button
        type="button"
        className="btn-ghost"
        title="슬랙 · 메신저에 붙여 넣는 결론 요약"
        disabled={copy?.state === "copying"}
        onClick={() => void copyReport("summary")}
      >
        {label("summary", "요약 복사")}
      </button>
    </div>
  );
}
