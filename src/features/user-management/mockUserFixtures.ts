import type { UserRole } from "@/types/auth";
import type { ManagedUser, OrganizationOption } from "./userManagementTypes";

export const mockOrganizations:OrganizationOption[]=[
  {publicId:"11111111-1111-4111-8111-111111111101",name:"중부고속도로 관제센터",code:"CTRL-JB",type:"CONTROL_CENTER",parentPublicId:"11111111-1111-4111-8111-111111111102",parentName:"수도권 광역 도로안전 운영본부",isActive:true},
  {publicId:"11111111-1111-4111-8111-111111111102",name:"수도권 광역 도로안전 운영본부",code:"HQ-SMA",type:"OPERATIONS_HEADQUARTERS",parentPublicId:null,parentName:null,isActive:true},
  {publicId:"11111111-1111-4111-8111-111111111103",name:"영동권 현장대응 지원센터",code:"FIELD-YD",type:"FIELD_SUPPORT",parentPublicId:null,parentName:null,isActive:true},
  {publicId:"11111111-1111-4111-8111-111111111104",name:"영동고속도로 관제센터",code:"CTRL-YD",type:"CONTROL_CENTER",parentPublicId:"11111111-1111-4111-8111-111111111102",parentName:"수도권 광역 도로안전 운영본부",isActive:true},
  {publicId:"11111111-1111-4111-8111-111111111105",name:"중부권 현장대응 지원센터",code:"FIELD-JB",type:"FIELD_SUPPORT",parentPublicId:null,parentName:null,isActive:true},
  {publicId:"11111111-1111-4111-8111-111111111106",name:"도로 운영 교육 지원 조직",code:"FIELD-TRAINING",type:"FIELD_SUPPORT",parentPublicId:null,parentName:null,isActive:false},
];
const roleSets:UserRole[][]=[
  ["CONTROLLER"],["RESPONDER"],["GENERAL_USER"],["CONTROL_MANAGER"],["CONTROLLER","RESPONDER"],["SYSTEM_ADMIN"],
];
const names=["김관제","이출동","박일반","최책임","정다중","한관리","오도로","윤안전","서현장","장운영"];

export const mockManagedUsers:ManagedUser[]=Array.from({length:27},(_,index)=>{
  const number=index+1;
  const organization=index%5===2?null:mockOrganizations[index%mockOrganizations.length];
  const userName=index===8?"매우 긴 이름을 가진 도로 안전 통합 운영 담당자":`${names[index%names.length]} ${number}`;
  const email=index===9?"very.long.operations.account.address.for.layout.verification@metropolitan-road-safety.example.kr":`user${String(number).padStart(2,"0")}@roadbogo.kr`;
  const createdAt=new Date(Date.UTC(2026,6,29-index,1,index,0)).toISOString();
  const updatedAt=new Date(Date.UTC(2026,6,29-Math.floor(index/2),2,index,0)).toISOString();
  const roles=index===26?[]:roleSets[index%roleSets.length];
  return{
    publicId:`22222222-2222-4222-8222-${String(number).padStart(12,"0")}`,
    email,userName,phone:index%4===0?null:`010${String(12000000+number).padStart(8,"0")}`,
    accountStatus:index%6===0?"INACTIVE":"ACTIVE",organization,
    roles,lastLoginAt:index%7===0?null:new Date(Date.UTC(2026,6,28-(index%8),index%12,24,0)).toISOString(),
    createdAt,updatedAt,
    changes:index%4===0?[]:[
      {id:`change-${number}-1`,action:"사용자 정보 수정",summary:"연락처 및 소속 정보 확인",actor:"로컬 시스템 관리자",occurredAt:updatedAt},
      ...(index%3===0?[{id:`change-${number}-2`,action:"역할 변경",summary:"운영 역할 구성을 변경함",actor:"로컬 시스템 관리자",occurredAt:createdAt}]:[]),
    ],responderProfile:roles.includes("RESPONDER")?{responderCode:`RSP-${String(number).padStart(3,"0")}`,dutyStatus:"AVAILABLE",coverageArea:organization?.name??null,isDispatchEnabled:true,linked:true}:null,activeAssignments:index===1?2:0,
  };
});
