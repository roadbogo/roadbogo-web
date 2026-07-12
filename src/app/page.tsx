import { HealthPanel } from "@/components/health-panel";

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Roadbogo</p>
        <h1>도로 상황을 빠르게 확인하는 서비스의 시작점</h1>
        <p className="description">
          Next.js 프론트엔드, FastAPI 백엔드, AI 서빙 서버가 분리된 기본
          프로젝트 구조입니다.
        </p>
      </section>

      <HealthPanel />
    </main>
  );
}
