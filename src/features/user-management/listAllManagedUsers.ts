import type {ManagedUser,UserListQuery,UserManagementAdapter} from "./userManagementTypes";

const PAGE_SIZE=50;
const MAX_PAGES=1000;
const query:UserListQuery={page:1,size:PAGE_SIZE,keyword:"",view:"all",attentionReason:null,role:null,accountStatus:null,organizationPublicId:null,organizationUnassigned:false,sort:"created_at,desc"};

export async function listAllManagedUsers(adapter:UserManagementAdapter,signal:AbortSignal):Promise<ManagedUser[]>{
  const first=await adapter.listUsers(query,signal);
  const totalPages=Math.min(first.pagination.totalPages,MAX_PAGES);
  const pages=totalPages>1?await Promise.all(Array.from({length:totalPages-1},(_,index)=>adapter.listUsers({...query,page:index+2},signal))):[];
  const unique=new Map<string,ManagedUser>();
  [first,...pages].flatMap(result=>result.items).forEach(user=>unique.set(user.publicId,user));
  return [...unique.values()];
}
