// Shared data model for Enhanced Finder. Used by both the extension host and,
// in serialized form, the webview front-end.

/** A highlight range (columns are 0-based, end exclusive) within a match line. */
export interface MatchSubrange {
  startCol: number;
  endCol: number;
}

/** A single line of output: either a match line or a surrounding context line. */
export interface ResultLine {
  /** 1-based line number in the source file. */
  lineNumber: number;
  text: string;
  /** True for match lines, false for context (-A/-B/-C) lines. */
  isMatch: boolean;
  /** Highlight ranges within the line (match lines only). */
  matches?: MatchSubrange[];
}

/** A contiguous window of context + match line(s), as grouped by ripgrep. */
export interface MatchBlock {
  /** Stable id for selection (fileUri + ':' + anchorLine). */
  id: string;
  fileUri: string;
  /** 1-based line to reveal/center when opening this block. */
  anchorLine: number;
  /** 0-based column of the first submatch on the anchor line. */
  anchorColumn: number;
  lines: ResultLine[];
}

/** All match blocks found in a single file. */
export interface FileResult {
  fileUri: string;
  /** Workspace-relative path for display. */
  relPath: string;
  blocks: MatchBlock[];
}

/** The complete (or truncated) result set for one search. */
export interface SearchModel {
  files: FileResult[];
  truncated: boolean;
  totalMatches: number;
}

/** User-controllable search options gathered from the webview. */
export interface SearchOptions {
  query: string;
  /** Treat the query as a regular expression (false = fixed string). */
  isRegex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  /** Context lines after a match (-A). Ignored when `contextBoth` is set. */
  contextAfter: number;
  /** Context lines before a match (-B). Ignored when `contextBoth` is set. */
  contextBefore: number;
  /** Context lines both before and after (-C). Overrides A/B when > 0. */
  contextBoth: number;
  /** Comma/newline separated include globs. */
  includeGlobs: string[];
  /** Comma/newline separated exclude globs. */
  excludeGlobs: string[];
}

export function blockId(fileUri: string, anchorLine: number): string {
  return `${fileUri}:${anchorLine}`;
}
