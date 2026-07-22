import{describe,expect,it}from"vitest";import type{IncidentDetailDto,IncidentEvidenceDto,IncidentHistoryDto}from"./incidentApiTypes";import{mapIncidentDetail,mapIncidentDetailRecord,normalizeDetectionBbox}from"./incidentMapper";
const detail={public_id:"i",incident_no:"INC-1",status:"NEW",version_no:0,object:{object_category:"DEBRIS",class_code:null,class_name:null,tracked_object_public_id:null,external_track_id:null},ai_analysis:{representative_confidence:null,confidence_calculation_type:null,risk_score:81,risk_grade:"HIGH",duration_ms:1200,repeat_count:null,rule_code:null,rule_version:null,reason_codes:["STOPPED"]},cctv_snapshot:{cctv_public_id:"c",cctv_name:"CAM",direction_code:"ASC",road_name:"도로",road_section_name:"구간",latitude:37,longitude:127,km_post:null},timeline:{first_detected_at:"2026-07-20T00:00:00.000Z",last_detected_at:"2026-07-20T00:01:00.000Z",created_at:"2026-07-20T00:00:00.000Z",updated_at:"2026-07-20T00:01:00.000Z",acknowledged_at:null,claimed_at:null,review_started_at:null,closed_at:null},controller:null,decision:null,active_dispatch:null,representative_evidence:null,evidence_count:1,memo_count:0}satisfies IncidentDetailDto;
const evidence={detection_public_id:null,evidence_type:"PRIMARY",is_representative:true,detected_at:"2026-07-20T00:00:00.000Z",class_code:null,class_name:null,confidence:null,bbox:null,original_image_url:null,annotated_image_url:null,risk:null}satisfies IncidentEvidenceDto;
const history={public_id:"h",from_status:null,to_status:"NEW",actor_type:"SYSTEM",actor:null,change_source:"SYSTEM",reason_code:null,reason_text:null,changed_at:"2026-07-20T00:00:00.000Z"}satisfies IncidentHistoryDto;
describe("incident detail mapper",()=>{it("combines detail, evidence, and history without exposing backend DTOs",()=>{const record=mapIncidentDetailRecord(detail,[evidence],[history]);expect(record.incident).toMatchObject({class_code:null,class_name:null,representative_confidence:null});expect(record.evidences[0]).toMatchObject({detection_public_id:"evidence-0",confidence:null,class_name:null});expect(record.histories[0]).toMatchObject({label:"미확인",actor_name:null});expect(record.dispatch).toBeNull()})});

describe("representative evidence mapping",()=>{
 it("prefers the annotated image and maps a valid normalized bbox",()=>{
  const mapped=mapIncidentDetail({...detail,representative_evidence:{detection_public_id:"d",original_image_url:"/original.jpg",annotated_image_url:"/annotated.jpg",bbox:{x:.1,y:.2,width:.3,height:.4}}});
  expect(mapped.representative_image_url).toBe("/annotated.jpg");
  expect(mapped.detection_bbox).toEqual({x:.1,y:.2,width:.3,height:.4});
 });
 it("uses the original image when an annotation is absent",()=>{
  const mapped=mapIncidentDetail({...detail,representative_evidence:{detection_public_id:"d",original_image_url:"/original.jpg",annotated_image_url:null,bbox:null}});
  expect(mapped.representative_image_url).toBe("/original.jpg");
  expect(mapped.detection_bbox).toBeNull();
 });
 it.each([
  {x:-.1,y:0,width:.2,height:.2},{x:0,y:-.1,width:.2,height:.2},
  {x:0,y:0,width:0,height:.2},{x:0,y:0,width:.2,height:0},
  {x:.8,y:0,width:.3,height:.2},{x:0,y:.8,width:.2,height:.3},
 ])("rejects an invalid normalized bbox %#",bbox=>expect(normalizeDetectionBbox(bbox)).toBeNull());
});
