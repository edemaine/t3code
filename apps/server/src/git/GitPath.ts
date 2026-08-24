// Cygwin's default cygdrive prefix exposes Windows drives as /cygdrive/c.
// <https://cygwin.com/cygwin-ug-net/using.html#cygdrive>
const CYGWIN_DRIVE_PATH = /^\/cygdrive\/([a-zA-Z])(?:\/|$)/;
const normalizeWindowsDrive = (_match: string, drive: string) => `${drive.toUpperCase()}:/`;

export function normalizeGitPathForHost(value: string, platform: NodeJS.Platform): string {
  if (platform !== "win32") return value;
  return value.replace(CYGWIN_DRIVE_PATH, normalizeWindowsDrive);
}
