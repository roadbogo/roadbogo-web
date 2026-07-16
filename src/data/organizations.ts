export type OrganizationMode = "registered" | "new_request";

export type OrganizationType =
  | "CONTROL_CENTER"
  | "ROAD_MANAGEMENT"
  | "PUBLIC_AGENCY"
  | "FIELD_RESPONSE"
  | "PARTNER"
  | "OTHER";

export type Organization = {
  id: string;
  name: string;
  type: OrganizationType;
  typeLabel: string;
  region: string;
  emailDomains?: string[];
};

export type OrganizationSelection = {
  mode: OrganizationMode;
  organizationId: string | null;
  organizationName: string;
  organizationType?: OrganizationType;
  organizationRegion?: string;
  organizationContact?: string;
};

export const organizationTypeOptions: Array<{ value: OrganizationType; label: string }> = [
  { value: "CONTROL_CENTER", label: "관제센터" },
  { value: "ROAD_MANAGEMENT", label: "도로 관리 기관" },
  { value: "PUBLIC_AGENCY", label: "공공기관" },
  { value: "FIELD_RESPONSE", label: "현장 대응 기관" },
  { value: "PARTNER", label: "협력 기관" },
  { value: "OTHER", label: "기타" },
];

export const regionOptions = [
  "서울특별시", "부산광역시", "대구광역시", "인천광역시", "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
  "경기도", "강원특별자치도", "충청북도", "충청남도", "전북특별자치도", "전라남도", "경상북도", "경상남도", "제주특별자치도",
];

// TODO: 기관 검색 API가 마련되면 이 시범 데이터를 서버 응답으로 교체합니다.
export const organizations: Organization[] = [
  { id: "demo-control-seoul", name: "도로보GO 시범 관제센터", type: "CONTROL_CENTER", typeLabel: "관제센터", region: "서울특별시" },
  { id: "demo-road-gyeonggi", name: "도로보GO 시범 도로관리본부", type: "ROAD_MANAGEMENT", typeLabel: "도로 관리 기관", region: "경기도" },
  { id: "demo-response-busan", name: "도로보GO 시범 현장대응센터", type: "FIELD_RESPONSE", typeLabel: "현장 대응 기관", region: "부산광역시" },
];

const publicEmailDomains = new Set(["gmail.com", "naver.com", "kakao.com", "daum.net", "hanmail.net", "outlook.com"]);

export function getOrganizationSuggestionsByEmail(email: string, items: Organization[]): Organization[] {
  const domain = email.trim().toLowerCase().split("@")[1];
  if (!domain || publicEmailDomains.has(domain)) return [];
  return items.filter((item) => item.emailDomains?.some((candidate) => candidate.toLowerCase() === domain));
}
