import {DispatchActionWorkspace} from "@/features/dispatch/DispatchActionWorkspace";
export default async function DispatchActionPage({params}:{params:Promise<{dispatchPublicId:string}>}){const{dispatchPublicId}=await params;return <DispatchActionWorkspace publicId={dispatchPublicId}/>}
