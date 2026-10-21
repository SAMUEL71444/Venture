// Error alur auth yang sudah berbentuk kode frontend (dipakai mock backend dan
// pemeriksaan di lib/auth/api.js). `extra` mis. { retryAfter, attemptsLeft, fields }.
export class AuthFlowError extends Error {
  constructor(code, extra = {}) {
    super(code);
    this.code = code;
    this.extra = extra;
  }
}
