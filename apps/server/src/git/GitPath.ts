// Git for Windows/MSYS2 normally uses /c. Cygwin and WSL default to
// /cygdrive/c and /mnt/c, respectively.
// <https://github.com/git-for-windows/build-extra/blob/main/ReleaseNotes.md#known-issues>
// <https://cygwin.com/cygwin-ug-net/using.html#cygdrive>
// <https://learn.microsoft.com/en-us/windows/wsl/wsl-config#automount-settings>
const POSIX_WINDOWS_DRIVE_PATH = /^\/(?:(?:cygdrive|mnt)\/)?([a-zA-Z])(?:\/|$)/;
const normalizeWindowsDrive = (_match: string, drive: string) => `${drive.toUpperCase()}:/`;

export function normalizeGitPathForHost(value: string, platform: NodeJS.Platform): string {
  if (platform !== "win32") return value;
  return value.replace(POSIX_WINDOWS_DRIVE_PATH, normalizeWindowsDrive);
}
