interface DemoControlsProps {
  onAddIncident: () => void;
  onReset: () => void;
}

export function DemoControls({ onAddIncident, onReset }: DemoControlsProps) {
  return (
    <section className="demo-controls" aria-label="시연용 데모 도구">
      <button type="button" className="demo-button demo-button--primary" onClick={onAddIncident}>
        시연용 신규 사건 추가
      </button>
      <button type="button" className="demo-button demo-button--secondary" onClick={onReset}>
        시연용 초기화
      </button>
    </section>
  );
}
