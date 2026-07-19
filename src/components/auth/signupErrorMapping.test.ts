import { describe, expect, it } from "vitest";
import { mapSignupApiError, PASSWORD_POLICY_MESSAGE, REQUEST_ERROR_MESSAGE } from "./signupErrorMapping";

describe("mapSignupApiError", () => {
  it.each(["AUTH_EMAIL_ALREADY_EXISTS", "USER_EMAIL_DUPLICATED"])(
    "maps %s to the email field",
    (code) => {
      expect(mapSignupApiError(code, null)).toEqual({
        fieldErrors: { email: "이미 가입된 이메일입니다." },
        submitError: "",
      });
    },
  );

  it("maps password policy errors to the password field", () => {
    expect(mapSignupApiError("USER_PASSWORD_POLICY_VIOLATION", null)).toEqual({
      fieldErrors: { password: PASSWORD_POLICY_MESSAGE },
      submitError: "",
    });
  });

  it("maps common validation details to their fields", () => {
    expect(mapSignupApiError("COMMON_VALIDATION_ERROR", {
      fields: [{ field: "body.user_name", reason: "이름 형식을 확인해 주세요." }],
    })).toEqual({
      fieldErrors: { userName: "이름 형식을 확인해 주세요." },
      submitError: "",
    });
  });

  it("uses a form-level message for an unknown server error", () => {
    expect(mapSignupApiError("UNKNOWN_ERROR", null)).toEqual({
      fieldErrors: {},
      submitError: REQUEST_ERROR_MESSAGE,
    });
  });
});
