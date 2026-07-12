const services = [
  {
    name: "roadbogo-api",
    description: "서비스 API 서버",
    url: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"
  },
  {
    name: "roadbogo-ai",
    description: "AI 서빙 서버",
    url: process.env.NEXT_PUBLIC_AI_BASE_URL ?? "http://localhost:8010"
  }
];

export function HealthPanel() {
  return (
    <section className="health-grid" aria-label="서비스 상태 확인">
      {services.map((service) => (
        <article className="health-card" key={service.name}>
          <h2>{service.name}</h2>
          <p>{service.description}</p>
          <p>
            Health check: <code>{service.url}/health</code>
          </p>
        </article>
      ))}
    </section>
  );
}
