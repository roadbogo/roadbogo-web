import type { FilterOption, SortOption } from "@/components/control/controlTypes";

interface IncidentControlsProps {
  search: string;
  filter: FilterOption;
  sort: SortOption;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: FilterOption) => void;
  onSortChange: (value: SortOption) => void;
  onReset: () => void;
}

const filterOptions: { key: FilterOption; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "긴급", label: "긴급" },
  { key: "주의", label: "주의" },
  { key: "검토 중", label: "검토 중" },
  { key: "미배정", label: "미배정" }
];

const sortOptions: { key: SortOption; label: string }[] = [
  { key: "risk", label: "위험도 높은 순" },
  { key: "waiting", label: "대기시간 긴 순" },
  { key: "detectedAt", label: "최신 탐지 순" }
];

export function IncidentControls({
  search,
  filter,
  sort,
  onSearchChange,
  onFilterChange,
  onSortChange,
  onReset
}: IncidentControlsProps) {
  return (
    <div className="incident-controls" role="search">
      <div className="incident-controls__filters" aria-label="사건 필터">
        {filterOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`filter-button ${filter === option.key ? "filter-button--active" : ""}`}
            onClick={() => onFilterChange(option.key)}
            aria-pressed={filter === option.key}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="incident-controls__tools">
        <label className="incident-controls__search-label">
          <span className="sr-only">사건 검색</span>
          <input
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="사건 번호, 도로명, 유형 검색"
            aria-label="사건 검색"
          />
        </label>
        <label className="incident-controls__sort-label">
          <span className="sr-only">정렬 선택</span>
          <select value={sort} onChange={(event) => onSortChange(event.target.value as SortOption)} aria-label="사건 정렬">
            {sortOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="incident-controls__reset" onClick={onReset}>
          초기화
        </button>
      </div>
    </div>
  );
}
