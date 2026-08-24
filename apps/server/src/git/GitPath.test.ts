import { describe, expect, it } from "vite-plus/test";

import { normalizeGitPathForHost } from "./GitPath.ts";

describe("normalizeGitPathForHost", () => {
  it("converts Cygwin drive paths on Windows", () => {
    expect(normalizeGitPathForHost("/cygdrive/c/Users/example/repo", "win32")).toBe(
      "C:/Users/example/repo",
    );
    expect(normalizeGitPathForHost("/cygdrive/d", "win32")).toBe("D:/");
  });

  it("leaves other paths unchanged", () => {
    expect(normalizeGitPathForHost("/c/Users/example/repo", "win32")).toBe("/c/Users/example/repo");
    expect(normalizeGitPathForHost("/d/project", "win32")).toBe("/d/project");
    expect(normalizeGitPathForHost("/mnt/c/Users/example/repo", "win32")).toBe(
      "/mnt/c/Users/example/repo",
    );
    expect(normalizeGitPathForHost("C:/Users/example/repo", "win32")).toBe("C:/Users/example/repo");
    expect(normalizeGitPathForHost("C:\\Users\\example\\repo", "win32")).toBe(
      "C:\\Users\\example\\repo",
    );
    expect(normalizeGitPathForHost("//server/share/repo", "win32")).toBe("//server/share/repo");
    expect(normalizeGitPathForHost("/mnt/projects/repo", "win32")).toBe("/mnt/projects/repo");
    expect(normalizeGitPathForHost("/cygdrive/projects/repo", "win32")).toBe(
      "/cygdrive/projects/repo",
    );
    expect(normalizeGitPathForHost("/cygdrive/c/Users/example/repo", "linux")).toBe(
      "/cygdrive/c/Users/example/repo",
    );
  });
});
