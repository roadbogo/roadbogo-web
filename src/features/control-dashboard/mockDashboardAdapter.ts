import type { DashboardAdapter, DashboardCctv, DashboardDispatch, DashboardIncident, DashboardSnapshot } from "./dashboardTypes";
const cctvs:DashboardCctv[]=[
  ["cctv-01","CAM 01","LIVE","상행","NORMAL",true,false,"PLAYING","중부고속도로","남이천IC ~ 호법JC"],
  ["cctv-02","CAM 02","LIVE","상행","NORMAL",true,false,"PLAYING","중부고속도로","남이천IC ~ 호법JC"],
  ["cctv-03","CAM 03","DEMO","하행","NORMAL",true,false,"DEMO","영동고속도로","여주JC ~ 이천IC"],
  ["cctv-04","CAM 04","LIVE","서울","DELAYED",true,true,"FALLBACK","경부고속도로","수원신갈IC ~ 서울TG"],
  ["cctv-05","CAM 05","LIVE","강릉","FAILED",false,false,"UNAVAILABLE","영동고속도로","덕평IC ~ 호법JC"],
  ["cctv-06","CAM 06","LIVE","하행","NORMAL",true,false,"LOADING","서해안고속도로","서평택JC ~ 발안IC"],
].map(([public_id,cctv_name,source_type,direction_code,operational_status,has_stream,fallback_used,video_state,road_name,section_name])=>({public_id,cctv_name,source_type,direction_code,operational_status,has_stream,fallback_used,video_state,road:{road_name},road_section:{section_name}} as DashboardCctv));
const base={organization_public_id:"org-control-seoul",version_no:1,updated_at:"2026-07-19T05:26:00.000Z"};
const incidents:DashboardIncident[]=[
  ["incident-0012","INC-20260719-0012","cctv-02","NEW","낙하물","fallen_object",82.5,"HIGH",.91,4200,14,null,"2026-07-19T05:24:00.000Z"],
  ["incident-0013","INC-20260719-0013","cctv-01","NEW","정지 차량","stopped_vehicle",96.2,"CRITICAL",.94,8100,22,null,"2026-07-19T05:25:00.000Z"],
  ["incident-0008","INC-20260719-0008","cctv-03","ACKNOWLEDGED","보행자","pedestrian",71.4,"HIGH",.87,3300,8,null,"2026-07-19T05:10:00.000Z"],
  ["incident-0007","INC-20260719-0007","cctv-04","CLAIMED","낙하물","fallen_object",64.8,"MEDIUM",.84,5100,11,{public_id:"user-controller-other",display_name:"김관제"},"2026-07-19T04:54:00.000Z"],
  ["incident-0006","INC-20260719-0006","cctv-01","UNDER_REVIEW","역주행","wrong_way",88.1,"HIGH",.92,7200,19,{public_id:"user-controller-demo",display_name:"조정화"},"2026-07-19T04:40:00.000Z"],
  ["incident-0005","INC-20260719-0005","cctv-06","DISPATCH_REQUESTED","정지 차량","stopped_vehicle",75.2,"HIGH",.89,6200,16,{public_id:"user-controller-demo",display_name:"조정화"},"2026-07-19T04:35:00.000Z"],
  ["incident-0004","INC-20260719-0004","cctv-03","DISPATCHED","낙하물","fallen_object",61.0,"MEDIUM",.82,3900,9,{public_id:"user-controller-demo",display_name:"조정화"},"2026-07-19T04:20:00.000Z"],
  ["incident-0003","INC-20260719-0003","cctv-04","ACTION_COMPLETED","보행자","pedestrian",55.0,"MEDIUM",.78,2800,6,{public_id:"user-controller-demo",display_name:"조정화"},"2026-07-19T03:55:00.000Z"],
  ["incident-0002","INC-20260719-0002","cctv-05","CLOSED","낙하물","fallen_object",39.0,"LOW",.74,1700,4,{public_id:"user-controller-demo",display_name:"조정화"},"2026-07-19T03:20:00.000Z"],
  ["incident-0001","INC-20260719-0001","cctv-06","FALSE_POSITIVE","그림자","shadow",18.0,"LOW",.63,900,2,{public_id:"user-controller-demo",display_name:"조정화"},"2026-07-19T03:05:00.000Z"],
].map(([public_id,incident_no,cctv_public_id,status,object_category,class_name,current_risk_score,current_risk_grade,representative_confidence,duration_ms,detection_count,assigned_controller,created_at])=>({...base,public_id,incident_no,cctv_public_id,status,object_category,class_name,current_risk_score,current_risk_grade,representative_confidence,duration_ms,detection_count,assigned_controller,created_at} as DashboardIncident));
const dispatches:DashboardDispatch[]=[
  {public_id:"dispatch-0005",incident_public_id:"incident-0005",status:"REQUESTED",responder_label:"이천 대응팀",requested_at:"2026-07-19T04:36:00.000Z",updated_at:"2026-07-19T04:36:00.000Z"},
  {public_id:"dispatch-0004",incident_public_id:"incident-0004",status:"EN_ROUTE",responder_label:"여주 대응팀",requested_at:"2026-07-19T04:22:00.000Z",updated_at:"2026-07-19T05:14:00.000Z"},
  {public_id:"dispatch-0003",incident_public_id:"incident-0003",status:"ACTION_COMPLETED",responder_label:"수원 대응팀",requested_at:"2026-07-19T04:00:00.000Z",updated_at:"2026-07-19T05:18:00.000Z"},
];
export function createMockDashboardSnapshot():DashboardSnapshot {
  return {cctvs:[...cctvs],incidents:[...incidents],dispatches:[...dispatches],fetched_at:"2026-07-19T06:15:00.000Z",source:"mock"};
}
export class MockDashboardAdapter implements DashboardAdapter {
  async load():Promise<DashboardSnapshot>{return createMockDashboardSnapshot()}
  async refreshIncident(public_id:string){return incidents.find(item=>item.public_id===public_id)??null}
  async refreshDispatch(public_id:string){return dispatches.find(item=>item.public_id===public_id)??null}
}
