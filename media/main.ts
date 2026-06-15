// Webview front-end for Enhanced Finder. Vanilla TS, bundled by esbuild.
import type { FileResult, MatchBlock, SearchModel, SearchOptions } from '../src/models';

interface VsCodeApi {
  postMessage(msg: unknown): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): void;
}
declare function acquireVsCodeApi(): VsCodeApi;
const vscode = acquireVsCodeApi();

interface PersistState {
  options: SearchOptions;
}

const DEFAULT_OPTIONS: SearchOptions = {
  query: '',
  isRegex: false,
  caseSensitive: false,
  wholeWord: false,
  contextAfter: 0,
  contextBefore: 0,
  contextBoth: 2,
  includeGlobs: [],
  excludeGlobs: [],
};

let options: SearchOptions = { ...DEFAULT_OPTIONS };
let model: SearchModel = { files: [], truncated: false, totalMatches: 0 };
const selected = new Set<string>();
let debounceTimer: number | undefined;

const app = document.getElementById('app')!;

function restore(): void {
  const state = vscode.getState<PersistState>();
  if (state?.options) {
    options = { ...DEFAULT_OPTIONS, ...state.options };
  }
}

function persist(): void {
  vscode.setState<PersistState>({ options });
}

function splitGlobs(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function scheduleSearch(): void {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(runSearch, 200);
}

function runSearch(): void {
  persist();
  vscode.postMessage({ type: 'search', options });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function highlight(text: string, ranges?: { startCol: number; endCol: number }[]): string {
  if (!ranges || ranges.length === 0) {
    return escapeHtml(text);
  }
  // ranges are byte offsets; for typical ASCII/UTF-8 source this maps closely.
  let html = '';
  let cursor = 0;
  for (const r of ranges) {
    const start = Math.max(cursor, r.startCol);
    const end = Math.max(start, r.endCol);
    html += escapeHtml(text.slice(cursor, start));
    html += `<span class="match">${escapeHtml(text.slice(start, end))}</span>`;
    cursor = end;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}

// --- rendering ---

function render(): void {
  app.innerHTML = '';
  app.appendChild(renderForm());
  app.appendChild(renderActions());
  app.appendChild(renderResults());
}

function renderForm(): HTMLElement {
  const form = el('div', 'form');

  const query = inputRow('Search', options.query, (v) => {
    options.query = v;
    scheduleSearch();
  });
  query.input.placeholder = 'Find in workspace…';

  const toggles = el('div', 'toggles');
  toggles.appendChild(toggle('Aa', 'Case sensitive', options.caseSensitive, (v) => {
    options.caseSensitive = v;
    runSearch();
  }));
  toggles.appendChild(toggle('│ab│', 'Whole word', options.wholeWord, (v) => {
    options.wholeWord = v;
    runSearch();
  }));
  toggles.appendChild(toggle('.*', 'Regular expression', options.isRegex, (v) => {
    options.isRegex = v;
    runSearch();
  }));
  query.row.appendChild(toggles);
  form.appendChild(query.row);

  // Context controls (grep -A / -B / -C).
  const ctx = el('div', 'context-row');
  ctx.appendChild(numberField('Before (-B)', options.contextBefore, options.contextBoth > 0, (v) => {
    options.contextBefore = v;
    runSearch();
  }));
  ctx.appendChild(numberField('After (-A)', options.contextAfter, options.contextBoth > 0, (v) => {
    options.contextAfter = v;
    runSearch();
  }));
  ctx.appendChild(numberField('Both (-C)', options.contextBoth, false, (v) => {
    options.contextBoth = v;
    render(); // re-render to enable/disable A/B
    runSearch();
  }));
  form.appendChild(ctx);
  if (options.contextBoth > 0) {
    const hint = el('div', 'hint');
    hint.textContent = 'Both (-C) overrides Before/After. Set it to 0 to use them.';
    form.appendChild(hint);
  }

  // Glob scope.
  const inc = inputRow('files to include', options.includeGlobs.join(', '), (v) => {
    options.includeGlobs = splitGlobs(v);
    scheduleSearch();
  });
  inc.input.placeholder = 'e.g. src/**/*.ts';
  form.appendChild(inc.row);

  const exc = inputRow('files to exclude', options.excludeGlobs.join(', '), (v) => {
    options.excludeGlobs = splitGlobs(v);
    scheduleSearch();
  });
  exc.input.placeholder = 'e.g. **/node_modules/**';
  form.appendChild(exc.row);

  return form;
}

function renderActions(): HTMLElement {
  const bar = el('div', 'actions');
  const count = selected.size;

  const summary = el('span', 'summary');
  summary.textContent = model.totalMatches
    ? `${model.totalMatches} match${model.totalMatches === 1 ? '' : 'es'} in ${model.files.length} file${model.files.length === 1 ? '' : 's'}${model.truncated ? ' (truncated)' : ''}`
    : '';
  bar.appendChild(summary);

  const right = el('div', 'actions-right');
  const openBtn = el('button', 'btn primary') as HTMLButtonElement;
  openBtn.textContent = count ? `Open ${count} in grid` : 'Open in grid';
  openBtn.disabled = count === 0;
  openBtn.onclick = openGrid;
  right.appendChild(openBtn);

  if (count) {
    const clearBtn = el('button', 'btn') as HTMLButtonElement;
    clearBtn.textContent = 'Clear';
    clearBtn.onclick = () => {
      selected.clear();
      render();
    };
    right.appendChild(clearBtn);
  }
  bar.appendChild(right);
  return bar;
}

function renderResults(): HTMLElement {
  const container = el('div', 'results');
  if (model.files.length === 0) {
    const empty = el('div', 'empty');
    empty.textContent = options.query.trim() ? 'No results.' : 'Type to search.';
    container.appendChild(empty);
    return container;
  }
  for (const file of model.files) {
    container.appendChild(renderFile(file));
  }
  return container;
}

function renderFile(file: FileResult): HTMLElement {
  const wrap = el('div', 'file');
  const header = el('div', 'file-header');
  header.textContent = file.relPath;
  const badge = el('span', 'file-count');
  badge.textContent = String(file.blocks.length);
  header.appendChild(badge);
  wrap.appendChild(header);

  for (const block of file.blocks) {
    wrap.appendChild(renderBlock(block));
  }
  return wrap;
}

function renderBlock(block: MatchBlock): HTMLElement {
  const wrap = el('div', 'block');

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'block-check';
  check.checked = selected.has(block.id);
  check.title = 'Select for grid open';
  check.onchange = () => {
    if (check.checked) {
      selected.add(block.id);
    } else {
      selected.delete(block.id);
    }
    renderActionsInPlace();
  };
  wrap.appendChild(check);

  const code = el('div', 'code');
  for (const line of block.lines) {
    const row = el('div', `line ${line.isMatch ? 'is-match' : 'is-context'}`);
    const ln = el('span', 'ln');
    ln.textContent = String(line.lineNumber);
    const content = el('span', 'content');
    content.innerHTML = highlight(line.text, line.matches);
    row.appendChild(ln);
    row.appendChild(content);
    if (line.isMatch) {
      row.onclick = () =>
        vscode.postMessage({
          type: 'openMatch',
          fileUri: block.fileUri,
          anchorLine: line.lineNumber,
          anchorColumn: line.matches?.[0]?.startCol ?? 0,
        });
    }
    code.appendChild(row);
  }
  wrap.appendChild(code);
  return wrap;
}

function renderActionsInPlace(): void {
  const old = app.querySelector('.actions');
  const fresh = renderActions();
  if (old) {
    old.replaceWith(fresh);
  }
}

function selectedBlocks(): MatchBlock[] {
  const result: MatchBlock[] = [];
  for (const file of model.files) {
    for (const block of file.blocks) {
      if (selected.has(block.id)) {
        result.push(block);
      }
    }
  }
  return result;
}

function openGrid(): void {
  const targets = selectedBlocks().map((b) => ({
    fileUri: b.fileUri,
    anchorLine: b.anchorLine,
    anchorColumn: b.anchorColumn,
  }));
  if (targets.length) {
    vscode.postMessage({ type: 'openGrid', targets });
  }
}

// --- small DOM helpers ---

function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  return node;
}

function inputRow(
  label: string,
  value: string,
  onInput: (v: string) => void,
): { row: HTMLElement; input: HTMLInputElement } {
  const row = el('div', 'input-row');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value;
  input.setAttribute('aria-label', label);
  input.oninput = () => onInput(input.value);
  row.appendChild(input);
  return { row, input };
}

function toggle(text: string, title: string, active: boolean, onToggle: (v: boolean) => void): HTMLElement {
  const b = el('button', `mini-toggle${active ? ' active' : ''}`);
  b.textContent = text;
  b.title = title;
  b.onclick = () => {
    onToggle(!active);
  };
  return b;
}

function numberField(label: string, value: number, disabled: boolean, onChange: (v: number) => void): HTMLElement {
  const wrap = el('label', `num-field${disabled ? ' disabled' : ''}`);
  const span = el('span', 'num-label');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.value = String(value);
  input.disabled = disabled;
  input.onchange = () => onChange(Math.max(0, parseInt(input.value, 10) || 0));
  wrap.appendChild(span);
  wrap.appendChild(input);
  return wrap;
}

// --- host messages ---

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data;
  switch (msg.type) {
    case 'results':
      model = msg.model as SearchModel;
      // Drop selections that no longer exist.
      pruneSelection();
      render();
      break;
    case 'error':
      model = { files: [], truncated: false, totalMatches: 0 };
      render();
      showError(msg.message as string);
      break;
    case 'config':
      if (!vscode.getState<PersistState>()) {
        options.contextBoth = msg.defaultContextLines as number;
      }
      render();
      break;
  }
});

function pruneSelection(): void {
  const live = new Set<string>();
  for (const f of model.files) {
    for (const b of f.blocks) {
      live.add(b.id);
    }
  }
  for (const id of [...selected]) {
    if (!live.has(id)) {
      selected.delete(id);
    }
  }
}

function showError(message: string): void {
  const banner = el('div', 'error-banner');
  banner.textContent = message;
  app.prepend(banner);
}

restore();
render();
