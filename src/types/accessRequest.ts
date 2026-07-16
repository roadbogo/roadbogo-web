export type AccessRequestPurpose =
  | "GENERAL_SERVICE"
  | "CONTROL_WORK"
  | "FIELD_RESPONSE"
  | "ORGANIZATION_PARTNERSHIP"
  | "OTHER";

export type AccessRequestPayload = {
  applicant_name: string;
  email: string;
  phone: string;
  organization_name?: string;
  purpose: AccessRequestPurpose;
  additional_message?: string;
  terms_agreed: true;
  privacy_agreed: true;
};
export type AccessRequestStatus = "PENDING" | "APPROVED" | "REJECTED";

export type AccessRequestResult = {
  request_id: string;
  status: AccessRequestStatus;
  submitted_at: string;
};
