// Shared data model for Grep Finder. Used by both the extension host and,
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
  /** Context lines after a match (-A). Used when `contextMode` is 'split'. */
  contextAfter: number;
  /** Context lines before a match (-B). Used when `contextMode` is 'split'. */
  contextBefore: number;
  /** Context lines both before and after (-C). Used when `contextMode` is 'both'. */
  contextBoth: number;
  /**
   * Which context group is active: 'both' uses -C; 'split' uses -A/-B. The
   * other group's values are kept but ignored. Defaults to 'both' when omitted.
   */
  contextMode?: 'both' | 'split';
  /** Comma/newline separated include globs. */
  includeGlobs: string[];
  /** Comma/newline separated exclude globs. */
  excludeGlobs: string[];
  /** Restrict the search to files currently open in editor tabs. */
  openFilesOnly?: boolean;
}

/** How a selection of matches is opened. */
export type OpenMode = 'grid' | 'tabs';

/** One match to open: a file plus the position to reveal it at. */
export interface OpenTarget {
  fileUri: string;
  /** 1-based line to reveal/center. */
  anchorLine: number;
  /** 0-based column of the match start. */
  anchorColumn: number;
}

export function blockId(fileUri: string, anchorLine: number): string {
  return `${fileUri}:${anchorLine}`;
}
