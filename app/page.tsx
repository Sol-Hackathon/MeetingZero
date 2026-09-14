"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SavedMeeting {
  id: string;
  title: string;
  hostToken: string;
  createdAt: string;
}

const STORAGE_KEY = "meetingless.hosted";

function loadHosted(): SavedMeeting[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SavedMeeting[];
  } catch {
    return [];
  }
}

const EXAMPLE = {
  title: "신규 온보딩 플로우 개편 방향 결정",
  background:
    "가입 후 첫 주 이탈률이 42%로 지난 분기 대비 8%p 올랐습니다. 원인으로 (1) 초기 설정 단계가 6단계로 길다 (2) 핵심 기능 가치를 첫 세션에 못 느낀다 (3) 결제 유도가 너무 이르다 는 가설이 나와 있습니다. 개발 2명, 디자이너 1명을 3주간 투입할 수 있고, 이번 분기 안에 배포해야 합니다.",
  goal: "세 가설 중 무엇을 먼저 검증할지, 3주 안에 무엇을 만들지 정하기",
};

export default function HomePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [background, setBackground] = useState("");
  const [goal, setGoal] = useState("");
  const [maxRounds, setMaxRounds] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hosted, setHosted] = useState<SavedMeeting[]>([]);

  useEffect(() => setHosted(loadHosted()), []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/meetings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, background, goal, maxRounds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "질문 생성에 실패했습니다.");

      const entry: SavedMeeting = {
        id: data.meetingId,
        title,
        hostToken: data.hostToken,
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify([entry, ...loadHosted()].slice(0, 20)));
      router.push(`/m/${data.meetingId}?t=${encodeURIComponent(data.hostToken)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-12">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">회의없는회의</h1>
        <p className="mt-2 text-stone-600">
          주제와 배경만 적으면 AI가 물어볼 것을 정리합니다. 참여자는 링크를 받아 답만 하면 되고,
          모인 답변에서 아직 결론이 안 난 것만 다시 묻습니다.
        </p>
      </header>

      <form onSubmit={submit} className="card space-y-5 p-6">
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="title">
              회의 주제
            </label>
            <button
              type="button"
              className="btn-quiet"
              onClick={() => {
                setTitle(EXAMPLE.title);
                setBackground(EXAMPLE.background);
                setGoal(EXAMPLE.goal);
              }}
            >
              예시 채우기
            </button>
          </div>
          <input
            id="title"
            className="input mt-1.5"
            placeholder="예: 신규 온보딩 플로우 개편 방향 결정"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="background">
            배경
          </label>
          <p className="mt-1 text-xs text-stone-500">
            지금까지 있었던 일, 제약(일정·인원·예산), 이미 나온 안이 있다면 함께 적어주세요.
            여기 적힌 내용은 질문으로 다시 묻지 않습니다.
          </p>
          <textarea
            id="background"
            className="input mt-1.5 min-h-[160px] resize-y leading-relaxed"
            placeholder="현재 상황과 제약 조건을 적어주세요."
            value={background}
            onChange={(e) => setBackground(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="goal">
            이 회의로 얻고 싶은 결론 <span className="font-normal text-stone-400">(선택)</span>
          </label>
          <input
            id="goal"
            className="input mt-1.5"
            placeholder="예: 3주 안에 무엇을 만들지 하나로 정하기"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>

        <div>
          <span className="label">라운드 수</span>
          <p className="mt-1 text-xs text-stone-500">
            한 라운드 = 질문 배포 → 답변 수집 → 정리. 다음 라운드에서는 남은 쟁점만 다시 묻습니다.
          </p>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setMaxRounds(n)}
                className={
                  maxRounds === n
                    ? "btn bg-stone-900 text-white"
                    : "btn border border-stone-300 bg-white text-stone-600 hover:bg-stone-100"
                }
              >
                {n}라운드
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
          {loading ? "질문을 만드는 중… (최대 1분)" : "질문 만들기"}
        </button>
      </form>

      {hosted.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-stone-500">이 브라우저에서 만든 회의</h2>
          <ul className="mt-3 space-y-2">
            {hosted.map((meeting) => (
              <li key={meeting.id}>
                <a
                  className="card flex items-center justify-between px-4 py-3 hover:border-stone-400"
                  href={`/m/${meeting.id}?t=${encodeURIComponent(meeting.hostToken)}`}
                >
                  <span className="truncate text-sm font-medium">{meeting.title}</span>
                  <span className="ml-3 shrink-0 text-xs text-stone-400">
                    {new Date(meeting.createdAt).toLocaleDateString("ko-KR")}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
