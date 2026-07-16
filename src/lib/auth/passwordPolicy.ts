export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 64;

export function getPasswordChecks(value: string) {
  return {
    length: value.length >= PASSWORD_MIN_LENGTH && value.length <= PASSWORD_MAX_LENGTH,
    letter: /[A-Za-z]/.test(value),
    number: /\d/.test(value),
  };
}

export function isPasswordValid(value: string) {
  return Object.values(getPasswordChecks(value)).every(Boolean);
}
