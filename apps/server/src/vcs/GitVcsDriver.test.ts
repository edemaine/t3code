import * as NodePath from "@effect/platform-node/NodePath";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/unstable/process";
import { assert, it } from "@effect/vitest";

import { CheckpointRef, GitCommandError } from "@t3tools/contracts";
import { HostProcessPlatform } from "@t3tools/shared/hostProcess";
import * as ServerConfig from "../config.ts";
import * as GitVcsDriver from "./GitVcsDriver.ts";
import * as VcsProcess from "./VcsProcess.ts";
import { runVcsDriverContractSuite } from "./testing/VcsDriverContractHarness.ts";

const ServerConfigLayer = ServerConfig.layerTest(process.cwd(), {
  prefix: "t3-git-vcs-contract-",
});
const GitContractLayer = Layer.mergeAll(GitVcsDriver.vcsLayer, GitVcsDriver.layer).pipe(
  Layer.provide(ServerConfigLayer),
  Layer.provideMerge(VcsProcess.layer),
  Layer.provideMerge(NodeServices.layer),
);

const runGit = (cwd: string, args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const driver = yield* GitVcsDriver.GitVcsDriver;
    yield* driver.execute({
      operation: "GitVcsDriver.contract.git",
      cwd,
      args,
      timeoutMs: 10_000,
    });
  });

type GitContractError = GitCommandError | PlatformError.PlatformError;

runVcsDriverContractSuite<GitVcsDriver.GitVcsDriver, GitContractError>({
  name: "Git",
  kind: "git",
  layer: GitContractLayer,
  fixture: {
    createRepo: (cwd) =>
      Effect.gen(function* () {
        yield* runGit(cwd, ["init"]);
        yield* runGit(cwd, ["config", "user.email", "test@test.com"]);
        yield* runGit(cwd, ["config", "user.name", "Test"]);
      }),
    writeFile: (cwd, relativePath, contents) =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const absolutePath = path.join(cwd, relativePath);
        yield* fileSystem.makeDirectory(path.dirname(absolutePath), { recursive: true });
        yield* fileSystem.writeFileString(absolutePath, contents);
      }),
    trackFile: (cwd, relativePath) => runGit(cwd, ["add", relativePath]),
    commit: (cwd, message) => runGit(cwd, ["commit", "-m", message]),
    ignorePath: (cwd, pattern) =>
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* fileSystem.writeFileString(path.join(cwd, ".gitignore"), `${pattern}\n`);
      }),
  },
});

it.effect("GitVcsDriver forwards execute env to the VCS process", () => {
  let observedEnv: NodeJS.ProcessEnv | undefined;
  let observedAppendTruncationMarker: boolean | undefined;

  return Effect.gen(function* () {
    const driver = yield* GitVcsDriver.makeVcsDriverShape();

    yield* driver.execute({
      operation: "GitVcsDriver.test.env",
      cwd: "/repo",
      args: ["status"],
      env: {
        GIT_INDEX_FILE: "/tmp/t3-index",
      },
      appendTruncationMarker: true,
    });

    assert.deepStrictEqual(observedEnv, {
      GIT_INDEX_FILE: "/tmp/t3-index",
    });
    assert.strictEqual(observedAppendTruncationMarker, true);
  }).pipe(
    Effect.provideService(HostProcessPlatform, "linux"),
    Effect.provide(
      Layer.mergeAll(
        NodeServices.layer,
        Layer.mock(VcsProcess.VcsProcess)({
          run: (input) =>
            Effect.sync(() => {
              observedEnv = input.env;
              observedAppendTruncationMarker = input.appendTruncationMarker;
              return {
                exitCode: ChildProcessSpawner.ExitCode(0),
                stdout: "",
                stderr: "",
                stdoutTruncated: false,
                stderrTruncated: false,
              };
            }),
        }),
      ),
    ),
  );
});

it.effect("GitVcsDriver disables Cygwin globbing on Windows", () => {
  let observedEnv: NodeJS.ProcessEnv | undefined;

  return Effect.gen(function* () {
    const driver = yield* GitVcsDriver.makeVcsDriverShape();
    yield* driver.execute({
      operation: "GitVcsDriver.test.cygwinEnv",
      cwd: "C:/repo",
      args: ["status"],
    });

    assert.deepStrictEqual(observedEnv, { CYGWIN: "noglob" });
  }).pipe(
    Effect.provideService(HostProcessPlatform, "win32"),
    Effect.provide(
      Layer.mergeAll(
        NodeServices.layer,
        Layer.mock(VcsProcess.VcsProcess)({
          run: (input) =>
            Effect.sync(() => {
              observedEnv = input.env;
              return {
                exitCode: ChildProcessSpawner.ExitCode(0),
                stdout: "",
                stderr: "",
                stdoutTruncated: false,
                stderrTruncated: false,
              };
            }),
        }),
      ),
    ),
  );
});

it.effect("GitVcsDriver retains Cygwin quote parsing for quoted arguments", () => {
  let observedEnv: NodeJS.ProcessEnv | undefined;
  const env = { LC_ALL: "zh_CN.UTF-8" };

  return Effect.gen(function* () {
    const driver = yield* GitVcsDriver.makeVcsDriverShape();
    yield* driver.execute({
      operation: "GitVcsDriver.test.cygwinQuotedArgs",
      cwd: "C:/repo",
      args: ["-c", 'alias.print-locale=!printf "%s" "$LC_ALL"', "print-locale"],
      env,
    });

    assert.strictEqual(observedEnv, env);
  }).pipe(
    Effect.provideService(HostProcessPlatform, "win32"),
    Effect.provide(
      Layer.mergeAll(
        NodeServices.layer,
        Layer.mock(VcsProcess.VcsProcess)({
          run: (input) =>
            Effect.sync(() => {
              observedEnv = input.env;
              return {
                exitCode: ChildProcessSpawner.ExitCode(0),
                stdout: "",
                stderr: "",
                stdoutTruncated: false,
                stderrTruncated: false,
              };
            }),
        }),
      ),
    ),
  );
});

it.effect("normalizes Cygwin repository paths on Windows", () =>
  Effect.gen(function* () {
    const driver = yield* GitVcsDriver.makeVcsDriverShape();
    const repository = yield* driver.detectRepository("C:/repo");

    assert.deepInclude(repository, {
      rootPath: "C:/repo",
      metadataPath: "C:/repo/.git",
    });
  }).pipe(
    Effect.provideService(HostProcessPlatform, "win32"),
    Effect.provide(
      Layer.mergeAll(
        NodeServices.layer,
        Layer.mock(VcsProcess.VcsProcess)({
          run: (input) =>
            Effect.succeed({
              exitCode: ChildProcessSpawner.ExitCode(0),
              stdout: input.args.includes("--is-inside-work-tree")
                ? "true\n"
                : input.args.includes("--show-toplevel")
                  ? "/cygdrive/c/repo\n"
                  : "/cygdrive/c/repo/.git\n",
              stderr: "",
              stdoutTruncated: false,
              stderrTruncated: false,
            }),
        }),
      ),
    ),
  ),
);

it.effect("uses a Windows path for Cygwin Git checkpoint indexes", () => {
  const observedIndexPaths: Array<string> = [];

  return Effect.gen(function* () {
    const driver = yield* GitVcsDriver.makeVcsDriverShape();
    yield* driver.checkpoints.captureCheckpoint({
      cwd: "C:/repo",
      checkpointRef: CheckpointRef.make("refs/t3/checkpoints/test"),
    });

    assert.isNotEmpty(observedIndexPaths);
    for (const indexPath of observedIndexPaths) {
      assert.match(indexPath, /^C:\\repo\\\.git\\t3-checkpoint-index-/);
    }
  }).pipe(
    Effect.provideService(HostProcessPlatform, "win32"),
    Effect.provide(
      Layer.mergeAll(
        NodeServices.layer,
        NodePath.layerWin32,
        Layer.mock(VcsProcess.VcsProcess)({
          run: (input) =>
            Effect.sync(() => {
              if (input.env?.GIT_INDEX_FILE) {
                observedIndexPaths.push(input.env.GIT_INDEX_FILE);
              }
              const isHeadCheck =
                input.args.includes("HEAD^{commit}") && input.args.includes("--verify");
              return {
                exitCode: ChildProcessSpawner.ExitCode(isHeadCheck ? 1 : 0),
                stdout: input.args.includes("--git-common-dir")
                  ? "/cygdrive/c/repo/.git\n"
                  : input.args.includes("write-tree")
                    ? "tree-oid\n"
                    : input.args.includes("commit-tree")
                      ? "commit-oid\n"
                      : "",
                stderr: "",
                stdoutTruncated: false,
                stderrTruncated: false,
              };
            }),
        }),
      ),
    ),
  );
});
