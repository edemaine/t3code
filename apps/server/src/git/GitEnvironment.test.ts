import { describe, expect, it } from "vite-plus/test";

import { gitProcessEnvironment } from "./GitEnvironment.ts";

describe("gitProcessEnvironment", () => {
  it("disables Cygwin globbing on Windows", () => {
    expect(gitProcessEnvironment(["status"], "win32", undefined, {})).toEqual({
      CYGWIN: "noglob",
    });
  });

  it("preserves existing Cygwin options", () => {
    expect(
      gitProcessEnvironment(
        ["status"],
        "win32",
        { GIT_CONFIG_COUNT: "0" },
        {
          CYGWIN: "winsymlinks:native",
        },
      ),
    ).toEqual({
      GIT_CONFIG_COUNT: "0",
      CYGWIN: "winsymlinks:native noglob",
    });
  });

  it("prefers explicitly supplied Cygwin options", () => {
    expect(
      gitProcessEnvironment(
        ["status"],
        "win32",
        { CYGWIN: "glob:ignorecase" },
        {
          CYGWIN: "winsymlinks:native",
        },
      ),
    ).toEqual({ CYGWIN: "glob:ignorecase noglob" });
  });

  it("leaves non-Windows environments unchanged", () => {
    const env = { GIT_CONFIG_COUNT: "0" };
    expect(gitProcessEnvironment(["status"], "linux", env, {})).toBe(env);
  });

  it("retains Cygwin's normal parsing for arguments containing double quotes", () => {
    const env = { LC_ALL: "zh_CN.UTF-8" };
    expect(
      gitProcessEnvironment(
        ["-c", 'alias.print-locale=!printf "%s" "$LC_ALL"', "print-locale"],
        "win32",
        env,
        {},
      ),
    ).toBe(env);
  });
});
