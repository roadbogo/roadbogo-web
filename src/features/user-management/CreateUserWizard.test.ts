import {describe,expect,it} from "vitest";
import {formatAdminPhone,normalizeAdminPhone} from "./CreateUserWizard";

describe("운영 사용자 등록 입력 변환",()=>{
 it("formats and normalizes a Korean mobile number",()=>{
  expect(formatAdminPhone("01012345678")).toBe("010-1234-5678");
  expect(normalizeAdminPhone("010-1234-5678")).toBe("01012345678");
 });
 it("normalizes the supported +82 mobile form",()=>{
  expect(normalizeAdminPhone("+82 10-1234-5678")).toBe("01012345678");
 });
});
