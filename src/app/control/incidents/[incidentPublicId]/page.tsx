import{IncidentCommandWorkspace}from"@/features/incident-detail/IncidentCommandWorkspace";
export default async function IncidentDetailPage({params}:{params:Promise<{incidentPublicId:string}>}){const{incidentPublicId}=await params;return <IncidentCommandWorkspace publicId={incidentPublicId}/>}
