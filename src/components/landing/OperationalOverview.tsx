type OperationRole = {
  step: string;
  key: "vision" | "control" | "field";
  title: string;
  englishLabel: string;
  description: string;
  items: string[];
  tone: "teal" | "blue" | "warm";
};

const roles: OperationRole[] = [
  {
    step: "01",
    key: "vision",
    title: "AI 위험 탐지",
    englishLabel: "AI DETECTION",
    description: "CCTV 영상을 분석해 위험 객체를 분류하고 탐지 근거를 생성합니다.",
    items: ["CCTV 실시간 분석", "위험 객체 분류", "탐지 근거 생성"],
    tone: "teal",
  },
  {
    step: "02",
    key: "control",
    title: "관제 판단",
    englishLabel: "CONTROL CENTER",
    description: "AI 근거를 검토하고 실제 위험 여부를 판정합니다.",
    items: ["AI 근거 확인", "위험 여부 판단", "출동 담당자 배정"],
    tone: "blue",
  },
  {
    step: "03",
    key: "field",
    title: "현장 대응",
    englishLabel: "FIELD RESPONSE",
    description: "출동부터 조치 완료까지 현장 결과를 기록합니다.",
    items: ["출동 및 상태 등록", "조치 결과 등록", "현장 조치 완료"],
    tone: "warm",
  },
];

const incidentFields = [
  ["사건 번호", "RB-260714-0821"],
  ["객체 유형", "낙하물"],
  ["위험도", "높음", "danger"],
  ["위치", "중부고속도로 137.4K"],
  ["현재 단계", "관제 판단", "progress"],
  ["담당 관제자", "배정 완료"],
  ["출동 상태", "담당자 배정 대기"],
  ["최근 업데이트", "08:28:02"],
  ["동기화 상태", "LIVE", "live"],
] as const;

function RoleIcon({ type }: { type: OperationRole["key"] }) {
  if (type === "vision") return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3.2"/><path d="M9.7 12h4.6"/></svg>;
  if (type === "control") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="m9 10 2 2 4-4M8 21h8M12 17v4"/></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><path d="m9 10 2 2 4-4"/></svg>;
}

function IncidentRecord() {
  return <article className="operation-record" aria-labelledby="operation-record-title">
    <header><div><p>SHARED INCIDENT RECORD</p><h3 id="operation-record-title">하나의 사건 기록</h3></div><span className="operation-record__status"><i/>실시간 공유</span></header>
    <dl>{incidentFields.map(([label, value, state]) => <div key={label}><dt>{label}</dt><dd className={state ? `is-${state}` : undefined}>{value}</dd></div>)}</dl>
  </article>;
}

export function OperationalOverview() {
  return <section className="operational-overview" aria-labelledby="operational-overview-title">
    <div className="operational-overview__copy">
      <p>OPERATIONAL OVERVIEW</p>
      <h2 id="operational-overview-title">하나의 사건 정보로<br/>관제와 현장을 연결합니다.</h2>
      <p>AI 탐지 결과와 관제 판단, 출동 진행 상태와 현장 조치 결과를 하나의 사건 기록으로 연결해 같은 정보를 실시간으로 공유합니다.</p>
      <div className="operational-overview__chips"><span>AI 영상 분석</span><span>통합 사건 관리</span><span>실시간 상태 공유</span></div>
      <ul className="operational-overview__principles"><li>공통 사건 번호 기준 정보 통합</li><li>관제와 현장 역할 분리</li><li>상태 변경 및 조치 결과 실시간 공유</li></ul>
    </div>
    <div className="operation-system" aria-label="AI 위험 탐지부터 현장 대응까지의 통합 사건 운영 구조">
      <div className="operation-system__roles">
        {roles.map((role, index) => <div className="operation-role-wrap" key={role.key}>
          <article className={`operation-role operation-role--${role.tone}`}>
            <header><span className="operation-role__number">{role.step}</span><span className="operation-role__icon"><RoleIcon type={role.key}/></span></header>
            <p>{role.englishLabel}</p><h3>{role.title}</h3><strong>{role.description}</strong>
            <ul>{role.items.map(item => <li key={item}>{item}</li>)}</ul>
          </article>
          {index < roles.length - 1 && <div className="operation-transfer" aria-label={index === 0 ? "사건 자동 생성" : "출동 요청 전달"}><span>{index === 0 ? "사건 자동 생성" : "출동 요청 전달"}</span><i/></div>}
        </div>)}
      </div>
      <IncidentRecord/>
    </div>
  </section>;
}
