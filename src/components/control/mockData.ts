import type { ActivityLogEntry, CctvFeed, DispatchTeam, Incident } from "@/components/control/controlTypes";

export const initialIncidents: Incident[] = [
  {
    id: "1",
    number: "INC-031",
    status: "new",
    severity: "긴급",
    type: "낙하물 사고",
    road: "경부고속도로",
    direction: "부산 방향",
    segment: "기흥IC → 수원신갈IC",
    cctvId: "CCTV 01",
    risk: 92,
    riskLabel: "고위험",
    evidence: "바닥에 떨어진 화물과 파손된 구조물",
    detectedAt: "14:20",
    detectedAtTs: new Date().toISOString(),
    waiting: "01:12",
    assignedTo: undefined,
    dispatchRequested: false,
    highlighted: false
  },
  {
    id: "2",
    number: "INC-028",
    status: "claimed",
    severity: "주의",
    type: "야생동물 출몰",
    road: "영동고속도로",
    direction: "강릉 방향",
    segment: "여주IC → 문막IC",
    cctvId: "CCTV 02",
    risk: 82,
    riskLabel: "주의",
    evidence: "차선에 나타난 야생동물",
    detectedAt: "14:15",
    detectedAtTs: new Date(new Date().setMinutes(new Date().getMinutes() - 5)).toISOString(),
    waiting: "00:45",
    assignedTo: "운영자_01",
    claimedAtTs: new Date(new Date().setMinutes(new Date().getMinutes() - 3)).toISOString(),
    dispatchRequested: false,
    highlighted: false
  },
  {
    id: "3",
    number: "INC-029",
    status: "new",
    severity: "주의",
    type: "낙하물",
    road: "서해안고속도로",
    direction: "목포 방향",
    segment: "서평택IC → 당진IC",
    cctvId: "CCTV 03",
    risk: 78,
    riskLabel: "중위험",
    evidence: "도로 중앙에 낙하물 흔적",
    detectedAt: "14:05",
    detectedAtTs: new Date(new Date().setMinutes(new Date().getMinutes() - 15)).toISOString(),
    waiting: "00:30",
    assignedTo: undefined,
    dispatchRequested: false,
    highlighted: false
  }
];

export const initialCctvFeeds: CctvFeed[] = [
  {
    id: "CCTV 01",
    label: "경부고속도로 / 부산 방향",
    event: "낙하물",
    duration: "02:18",
    road: "경부고속도로",
    direction: "부산 방향",
    station: "CCTV 01",
    relatedIncidentIds: ["1"]
  },
  {
    id: "CCTV 02",
    label: "영동고속도로 / 강릉 방향",
    event: "야생동물",
    duration: "01:45",
    road: "영동고속도로",
    direction: "강릉 방향",
    station: "CCTV 02",
    relatedIncidentIds: ["2"]
  },
  {
    id: "CCTV 03",
    label: "서해안고속도로 / 목포 방향",
    event: "낙하물",
    duration: "00:58",
    road: "서해안고속도로",
    direction: "목포 방향",
    station: "CCTV 03",
    relatedIncidentIds: ["3"]
  },
  {
    id: "CCTV 04",
    label: "중부고속도로 / 하남 방향",
    event: "야생동물",
    duration: "03:12",
    road: "중부고속도로",
    direction: "하남 방향",
    station: "CCTV 04",
    relatedIncidentIds: []
  },
  {
    id: "CCTV 05",
    label: "남해고속도로 / 순천 방향",
    event: "낙하물",
    duration: "01:07",
    road: "남해고속도로",
    direction: "순천 방향",
    station: "CCTV 05",
    relatedIncidentIds: []
  },
  {
    id: "CCTV 06",
    label: "서울양양고속도로 / 양양 방향",
    event: "야생동물",
    duration: "02:36",
    road: "서울양양고속도로",
    direction: "양양 방향",
    station: "CCTV 06",
    relatedIncidentIds: []
  }
];

export const initialDispatchTeams: DispatchTeam[] = [
  {
    id: "team-1",
    name: "청주지사 A-01",
    task: "경부고속도로 부산 방향 23km",
    eta: "11분 후",
    status: "현장 이동 중"
  },
  {
    id: "team-2",
    name: "인천지사 B-03",
    task: "중부고속도로 강릉 방향 58km",
    eta: "8분 후",
    status: "현장 조치 중"
  }
];

export const initialActivityLog: ActivityLogEntry[] = [
  {
    id: "log-1",
    time: "14:20",
    actor: "시스템",
    action: "CCTV 02에서 야생동물이 탐지되었습니다.",
    target: "INC-028",
    incidentId: "2",
    badge: "주의",
    variant: "info"
  },
  {
    id: "log-2",
    time: "14:15",
    actor: "운영자_01",
    action: "INC-031 사건을 선점했습니다.",
    target: "INC-031",
    incidentId: "1",
    badge: "진행",
    variant: "success"
  }
];

export const toastDurations = {
  success: 5000,
  info: 6000,
  warning: 7000,
  urgent: 9000
};
