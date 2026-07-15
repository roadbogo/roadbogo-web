import type { AuthUser } from "@/types/auth";

export const AUTH_USER_KEY="roadbogo_auth_user";
export const ACCESS_TOKEN_KEY="roadbogo_access_token";
export const AUTH_EXPIRED_KEY="roadbogo_auth_expired";

export function readStoredAuthUser():AuthUser|null{
  if(typeof window==="undefined")return null;
  try{const raw=localStorage.getItem(AUTH_USER_KEY);if(!raw)return null;const parsed=JSON.parse(raw) as AuthUser;if(!parsed.email||!parsed.userName||!Array.isArray(parsed.roles))return null;return parsed}catch{return null}
}
export function storeAuthUser(user:AuthUser){localStorage.setItem(AUTH_USER_KEY,JSON.stringify(user))}
export function clearClientAuth(){
  localStorage.removeItem(AUTH_USER_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem("roadbogo-demo-auth");
  sessionStorage.removeItem("roadbogo_return_to");
}
