import "server-only";
import { getDefaultCookieOptions, CookieOptions } from "../security";

export const SESSION_COOKIE_NAME = "verane_session";

export function getSessionCookieConfig(overrideOptions?: CookieOptions) {
  return {
    name: SESSION_COOKIE_NAME,
    options: getDefaultCookieOptions({
      maxAge: 60 * 60 * 24 * 7, // 7 days
      ...overrideOptions,
    }),
  };
}
