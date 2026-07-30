import {describe,expect,it} from "vitest";
import {mockOrganizations} from "./mockUserFixtures";
import {filterOrganizations} from "./OrganizationExplorer";
describe("organization explorer search",()=>{
 it.each([["중부","중부고속도로 관제센터"],["CTRL-YD","영동고속도로 관제센터"],["운영본부","수도권 광역 도로안전 운영본부"],["  도로안전  ","수도권 광역 도로안전 운영본부"]])("finds %s", (keyword,name)=>expect(filterOrganizations(mockOrganizations,keyword).some(item=>item.name===name)).toBe(true));
 it("excludes inactive reference organizations",()=>expect(filterOrganizations(mockOrganizations,"교육")).toEqual([]));
});
