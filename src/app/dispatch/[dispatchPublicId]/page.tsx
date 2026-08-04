import {DispatchWorkspace} from "@/features/dispatch/DispatchWorkspace";
export default async function DispatchDetailPage({params}:{params:Promise<{dispatchPublicId:string}>}){const{dispatchPublicId}=await params;return <DispatchWorkspace initialPublicId={dispatchPublicId}/>}
