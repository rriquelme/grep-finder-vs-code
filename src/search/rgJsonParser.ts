// Incremental parser for ripgrep's `--json` (NDJSON) output. Converts the event
// stream into a SearchModel, grouping context + match lines into MatchBlocks.
//
// Kept free of VS Code imports so it can be unit-tested with captured fixtures.
import {
  blockId,
  type FileResult,
  type MatchBlock,
  type MatchSubrange,
  type ResultLine,
  type SearchModel,
} from '../models';

// --- ripgrep JSON event shapes (only the fields we use) ---

interface RgText {
  text?: string;
  bytes?: string;
}

interface RgSubmatch {
  match: RgText;
  start: number; // byte offset within the line
  end: number;
}

interface RgLineData {
  path: RgText;
  lines: RgText;
  line_number?: number;
  submatches?: RgSubmatch[];
}

interface RgEvent {
  type: 'begin' | 'end' | 'match' | 'context' | 'summary';
  data: RgLineData & { path?: RgText };
}

function textOf(t: RgText | undefined): string {
  if (!t) {
    return '';
  }
  if (typeof t.text === 'string') {
    return t.text;
  }
  if (typeof t.bytes === 'string') {
    return Buffer.from(t.bytes, 'base64').toString('utf8');
  }
  return '';
}

function stripEol(s: string): string {
  return s.replace(/\r?\n$/, '');
}

/**
 * Stateful parser. Feed raw stdout chunks via `push`, then call `finish`.
 * Lines that don't parse as JSON are ignored (ripgrep may emit none, but this
 * keeps the parser resilient).
 */
export class RgJsonParser {
  private buffer = '';
  private pathToFile = new Map<string, FileResult>();
  private order: string[] = [];
  private current: { file: FileResult; block: MatchBlock | null; lastLine: number } | null = null;
  private totalMatches = 0;
  private truncated = false;

  constructor(
    private readonly toRelPath: (absPath: string) => string,
    private readonly toUri: (absPath: string) => string,
    private readonly maxResults = Number.POSITIVE_INFINITY,
  ) {}

  push(chunk: string): void {
    if (this.truncated) {
      return;
    }
    this.buffer += chunk;
    let nl: number;
    while ((nl = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, nl);
      this.buffer = this.buffer.slice(nl + 1);
      this.handleLine(line);
      if (this.truncated) {
        return;
      }
    }
  }

  finish(): SearchModel {
    if (this.buffer.trim()) {
      this.handleLine(this.buffer);
      this.buffer = '';
    }
    return this.build();
  }

  build(): SearchModel {
    const files = this.order
      .map((p) => this.pathToFile.get(p)!)
      .filter((f) => f.blocks.length > 0);
    return { files, truncated: this.truncated, totalMatches: this.totalMatches };
  }

  private handleLine(raw: string): void {
    const line = raw.trim();
    if (!line) {
      return;
    }
    let evt: RgEvent;
    try {
      evt = JSON.parse(line) as RgEvent;
    } catch {
      return;
    }
    switch (evt.type) {
      case 'begin':
        this.onBegin(evt);
        break;
      case 'match':
        this.onLine(evt, true);
        break;
      case 'context':
        this.onLine(evt, false);
        break;
      case 'end':
        this.current = null;
        break;
      default:
        break;
    }
  }

  private onBegin(evt: RgEvent): void {
    const abs = textOf(evt.data.path);
    let file = this.pathToFile.get(abs);
    if (!file) {
      file = { fileUri: this.toUri(abs), relPath: this.toRelPath(abs), blocks: [] };
      this.pathToFile.set(abs, file);
      this.order.push(abs);
    }
    this.current = { file, block: null, lastLine: -2 };
  }

  private onLine(evt: RgEvent, isMatch: boolean): void {
    if (!this.current) {
      // Defensive: ripgrep should always emit `begin` first.
      this.onBegin(evt);
    }
    const state = this.current!;
    const lineNumber = evt.data.line_number ?? 0;
    const text = stripEol(textOf(evt.data.lines));

    let matches: MatchSubrange[] | undefined;
    if (isMatch && evt.data.submatches?.length) {
      matches = evt.data.submatches.map((s) => ({ startCol: s.start, endCol: s.end }));
    }

    const resultLine: ResultLine = { lineNumber, text, isMatch, matches };

    // Start a new block when lines are non-contiguous (ripgrep separator).
    const contiguous = lineNumber === state.lastLine + 1;
    if (!state.block || !contiguous) {
      state.block = {
        id: '',
        fileUri: state.file.fileUri,
        anchorLine: lineNumber,
        anchorColumn: 0,
        lines: [],
      };
      state.file.blocks.push(state.block);
    }

    state.block.lines.push(resultLine);
    state.lastLine = lineNumber;

    if (isMatch) {
      // The first match line in a block defines its anchor.
      if (!state.block.lines.some((l) => l.isMatch && l !== resultLine)) {
        state.block.anchorLine = lineNumber;
        state.block.anchorColumn = matches?.[0]?.startCol ?? 0;
        state.block.id = blockId(state.file.fileUri, lineNumber);
      }
      this.totalMatches += matches?.length ?? 1;
      if (this.totalMatches >= this.maxResults) {
        this.truncated = true;
      }
    }
  }
}
