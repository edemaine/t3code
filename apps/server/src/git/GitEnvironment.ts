// When a Cygwin executable is launched by a native Windows process, Cygwin
// by default glob-expands braces and brackets.
// <https://cygwin.com/cygwin-ug-net/using-cygwinenv.html>
// T3 Code uses these characters in Git refs (such as `HEAD^{commit}`)
// and literal path names.
// Setting `CYGWIN=noglob` preserves those arguments, but Cygwin mishandles
// literal double quotes in this mode, converting them to backslashes.
// <https://cygwin.com/pipermail/cygwin/2016-May/227720.html>
// T3 Code can pass such quotes in Git commit messages, for example.
// Therefore, we set `CYGWIN=noglob` only for commands without double quotes.
// This workaround does not handle commands containing both braces/brackets and
// double quotes, but it's difficult to do so cleanly until Cygwin changes.

export function gitProcessEnvironment(
  args: ReadonlyArray<string>,
  platform: NodeJS.Platform,
  env?: NodeJS.ProcessEnv,
  inheritedEnv: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv | undefined {
  if (platform !== "win32" || args.some((arg) => arg.includes('"'))) return env;

  const cygwinOptions = (env?.CYGWIN ?? inheritedEnv.CYGWIN)?.trim();
  return {
    ...env,
    CYGWIN: cygwinOptions ? `${cygwinOptions} noglob` : "noglob",
  };
}
