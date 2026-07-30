import {describe,expect,it,vi} from "vitest";
import {listAllManagedUsers} from "./listAllManagedUsers";
import type {ManagedUser,UserManagementAdapter,UserListResult} from "./userManagementTypes";

const managed=(index:number):ManagedUser=>({publicId:`user-${index}`,email:`user${index}@roadbogo.test`,userName:`사용자 ${index}`,phone:null,accountStatus:"ACTIVE",organization:null,roles:["GENERAL_USER"],lastLoginAt:null,createdAt:"2026-07-01T00:00:00Z",updatedAt:"2026-07-01T00:00:00Z",changes:[]});
const result=(items:ManagedUser[],page:number,totalPages:number):UserListResult=>({items,summary:{total:75,operating:0,general:75,active:75,attention:0,unassigned:0,inactive:0,neverLoggedIn:0,withoutOrganization:0},pagination:{page,size:50,totalElements:75,totalPages}});

describe("listAllManagedUsers",()=>{
  it("loads every page and de-duplicates public ids",async()=>{
    const first=Array.from({length:50},(_,index)=>managed(index+1)),second=[managed(50),...Array.from({length:25},(_,index)=>managed(index+51))];
    const listUsers=vi.fn().mockImplementation(({page})=>Promise.resolve(page===1?result(first,1,2):result(second,2,2)));
    const users=await listAllManagedUsers({listUsers} as unknown as UserManagementAdapter,new AbortController().signal);
    expect(listUsers).toHaveBeenCalledTimes(2);expect(users).toHaveLength(75);expect(users.at(-1)?.publicId).toBe("user-75");
  });
  it("propagates abort failures",async()=>{
    const error=new DOMException("Aborted","AbortError"),adapter={listUsers:vi.fn().mockRejectedValue(error)} as unknown as UserManagementAdapter;
    await expect(listAllManagedUsers(adapter,new AbortController().signal)).rejects.toBe(error);
  });
});
