// Pure mapping from SearchOptions to ripgrep argv. Kept dependency-free so it
// can be unit-tested without VS Code or a real ripgrep binary.
import type { SearchOptions } from '../models';

export interface ArgBuildContext {
  /** Use smart-case when the user has not forced case sensitivity. */
  useSmartCase: boolean;
}

/**
 * Build the ripgrep argument vector (excluding the binary path and the search
 * root, which the caller appends). Always requests JSON output.
 *
 * Context semantics mirror grep/ripgrep: `-C` (contextBoth) overrides `-A`/`-B`.
 */
export function buildRgArgs(opts: SearchOptions, ctx: ArgBuildContext): string[] {
  const args: string[] = ['--json'];

  // Pattern interpretation.
  if (!opts.isRegex) {
    args.push('--fixed-strings');
  }
  if (opts.wholeWord) {
    args.push('--word-regexp');
  }

  // Case handling.
  if (opts.caseSensitive) {
    args.push('--case-sensitive');
  } else if (ctx.useSmartCase) {
    args.push('--smart-case');
  } else {
    args.push('--ignore-case');
  }

  // Context lines: -C overrides -A/-B.
  if (opts.contextBoth > 0) {
    args.push('-C', String(opts.contextBoth));
  } else {
    if (opts.contextBefore > 0) {
      args.push('-B', String(opts.contextBefore));
    }
    if (opts.contextAfter > 0) {
      args.push('-A', String(opts.contextAfter));
    }
  }

  // Include / exclude globs.
  for (const g of opts.includeGlobs) {
    const trimmed = g.trim();
    if (trimmed) {
      args.push('-g', trimmed);
    }
  }
  for (const g of opts.excludeGlobs) {
    const trimmed = g.trim();
    if (trimmed) {
      args.push('-g', `!${trimmed}`);
    }
  }

  // End of options, then the pattern. `--` guards patterns starting with '-'.
  args.push('--', opts.query);
  return args;
}
