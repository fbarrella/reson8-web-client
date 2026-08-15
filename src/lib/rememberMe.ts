/**
 * Key names match the desktop client's localStorage keys verbatim (CLAUDE.md
 * "Conventions worth knowing") — a deliberate consistency choice, not a
 * technical requirement.
 */
const REMEMBER_ME_KEY = "reson8-remember-me";
const SERVER_URL_KEY = "reson8-server-url";
const NICKNAME_KEY = "reson8-nickname";
const SERVER_PASSWORD_KEY = "reson8-server-password";

export interface RememberedConnection {
  serverUrl: string;
  nickname: string;
  password: string;
}

export function loadRememberedConnection(): RememberedConnection | null {
  if (localStorage.getItem(REMEMBER_ME_KEY) !== "true") return null;
  return {
    serverUrl: localStorage.getItem(SERVER_URL_KEY) ?? "",
    nickname: localStorage.getItem(NICKNAME_KEY) ?? "",
    password: localStorage.getItem(SERVER_PASSWORD_KEY) ?? "",
  };
}

export function isRememberMeEnabled(): boolean {
  return localStorage.getItem(REMEMBER_ME_KEY) === "true";
}

export function saveRememberedConnection(values: RememberedConnection): void {
  localStorage.setItem(REMEMBER_ME_KEY, "true");
  localStorage.setItem(SERVER_URL_KEY, values.serverUrl);
  localStorage.setItem(NICKNAME_KEY, values.nickname);
  localStorage.setItem(SERVER_PASSWORD_KEY, values.password);
}

export function clearRememberedConnection(): void {
  localStorage.removeItem(REMEMBER_ME_KEY);
  localStorage.removeItem(SERVER_URL_KEY);
  localStorage.removeItem(NICKNAME_KEY);
  localStorage.removeItem(SERVER_PASSWORD_KEY);
}
