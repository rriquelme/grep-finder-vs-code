// Pure mapping from SearchOptions to ripgrep argv. Kept dependency-free so it
// can be unit-tested without VS Code or a real ripgrep binary.
import type { SearchOptions } from '../models';

/**
 * Build the ripgrep argument vector (excluding the binary path and the search
 * root, which the caller appends). Always requests JSON output.
 *
 * Case handling matches VS Code's own search: "Match case" off means fully
 * case-insensitive (no surprising smart-case behavior).
 */
export function buildRgArgs(opts: SearchOptions): string[] {
  const args: string[] = ['--json'];

  // Pattern interpretation.
  if (!opts.isRegex) {
    args.push('--fixed-strings');
  }
  if (opts.wholeWord) {
    args.push('--word-regexp');
  }

  // Case handling: on = case-sensitive, off = always case-insensitive.
  if (opts.caseSensitive) {
    args.push('--case-sensitive');
  } else {
    args.push('--ignore-case');
  }

  // Context lines: 'both' mode uses -C; 'split' mode uses -A/-B. The inactive
  // group is ignored even if it still holds a value.
  const mode = opts.contextMode ?? (opts.contextBoth > 0 ? 'both' : 'split');
  if (mode === 'both') {
    if (opts.contextBoth > 0) {
      args.push('-C', String(opts.contextBoth));
    }
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
