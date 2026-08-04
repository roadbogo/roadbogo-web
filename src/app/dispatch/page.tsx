import {DispatchHub} from "@/features/dispatch/DispatchHub";
export default async function DispatchPage({searchParams}:{searchParams:Promise<{view?:string}>}){const{view}=await searchParams;return <DispatchHub initialView={view}/>}
