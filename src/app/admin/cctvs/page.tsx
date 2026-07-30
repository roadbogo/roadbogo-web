import {Suspense} from "react";
import {CctvNetworkAtlas} from "@/features/cctv-network/CctvNetworkAtlas";
export default function AdminCctvsPage(){return <Suspense fallback={<main role="status">CCTV 네트워크를 준비하고 있습니다.</main>}><CctvNetworkAtlas/></Suspense>}
