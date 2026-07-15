import { AUTH_EXPIRED_KEY, clearClientAuth } from "./authStorage";

let refreshRequest:Promise<boolean>|null=null;
async function refreshSession(){
  if(!refreshRequest)refreshRequest=fetch("/api/auth/refresh",{method:"POST",credentials:"include",cache:"no-store"}).then(response=>response.ok).catch(()=>false).finally(()=>{refreshRequest=null});
  return refreshRequest;
}
function expireSession(){
  clearClientAuth();
  sessionStorage.setItem(AUTH_EXPIRED_KEY,"true");
  window.dispatchEvent(new Event("roadbogo:auth-expired"));
  window.location.replace("/login?reason=expired");
}
export async function authFetch(input:RequestInfo|URL,init:RequestInit={}){
  const request=()=>fetch(input,{...init,credentials:"include"});
  let response=await request();
  if(response.status!==401)return response;
  if(await refreshSession()){response=await request();if(response.status!==401)return response}
  expireSession();
  return response;
}
