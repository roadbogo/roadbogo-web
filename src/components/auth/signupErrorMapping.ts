export const PASSWORD_POLICY_MESSAGE = "비밀번호는 8~64자이며 영문과 숫자를 포함해야 합니다.";
export const REQUEST_ERROR_MESSAGE = "회원가입 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export type SignupFieldName = "userName" | "email" | "password" | "passwordConfirmation";
export type SignupFieldErrors = Partial<Record<SignupFieldName, string>>;
type ValidationField = { field?: unknown; reason?: unknown };
export type SignupErrorMapping = { fieldErrors: SignupFieldErrors; submitError: string };

const serverFieldMap: Record<string, SignupFieldName> = {
  user_name: "userName",
  email: "email",
  password: "password",
  password_confirmation: "passwordConfirmation",
};

function mapValidationErrors(details: Record<string, unknown> | null): SignupFieldErrors {
  if (!details || !Array.isArray(details.fields)) return {};
  return details.fields.reduce<SignupFieldErrors>((errors, item) => {
    if (!item || typeof item !== "object") return errors;
    const { field, reason } = item as ValidationField;
    if (typeof field !== "string") return errors;
    const fieldName = serverFieldMap[field.split(".").at(-1) ?? ""];
    if (fieldName) errors[fieldName] = typeof reason === "string" ? reason : "입력 내용을 확인해 주세요.";
    return errors;
  }, {});
}

export function mapSignupApiError(code: string, details: Record<string, unknown> | null): SignupErrorMapping {
  if (code === "AUTH_EMAIL_ALREADY_EXISTS" || code === "USER_EMAIL_DUPLICATED") {
    return { fieldErrors: { email: "이미 가입된 이메일입니다." }, submitError: "" };
  }
  if (code === "USER_PASSWORD_POLICY_VIOLATION") {
    return { fieldErrors: { password: PASSWORD_POLICY_MESSAGE }, submitError: "" };
  }
  if (code === "COMMON_VALIDATION_ERROR") {
    const fieldErrors = mapValidationErrors(details);
    return Object.keys(fieldErrors).length
      ? { fieldErrors, submitError: "" }
      : { fieldErrors: {}, submitError: "입력 내용을 확인해 주세요." };
  }
  return { fieldErrors: {}, submitError: REQUEST_ERROR_MESSAGE };
}
