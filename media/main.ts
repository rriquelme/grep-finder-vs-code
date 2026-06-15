// Webview front-end for Enhanced Finder. Vanilla TS, bundled by esbuild.
//
// The search form is built ONCE and never re-rendered, so typing never loses
// focus. Only the actions bar and results list are refreshed when results
// arrive.
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
  contextMode: 'both',
  includeGlobs: [],
  excludeGlobs: [],
};

let options: SearchOptions = { ...DEFAULT_OPTIONS };
let model: SearchModel = { files: [], truncated: false, totalMatches: 0 };
const selected = new Set<string>();
let debounceTimer: number | undefined;
let searching = false;

// Keyboard navigation across match lines.
interface NavItem {
  blockId: string;
  fileUri: string;
  lineNumber: number;
  column: number;
  el: HTMLElement;
}
let navItems: NavItem[] = [];
let activeIndex = -1;

// Persistent layout hosts (built once).
const app = document.getElementById('app')!;
const actionsHost = el('div', 'actions-host');
const resultsHost = el('div', 'results-host');

// References to live form controls we may need to update in place.
let beforeInput!: HTMLInputElement;
let afterInput!: HTMLInputElement;
let bothInput!: HTMLInputElement;
let contextHint!: HTMLElement;

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
  searching = options.query.trim().length > 0;
  refreshActions();
  vscode.postMessage({ type: 'search', options });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlight(text: string, ranges?: { startCol: number; endCol: number }[]): string {
  if (!ranges || ranges.length === 0) {
    return escapeHtml(text);
  }
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

// --- one-time form construction ---

function buildForm(): HTMLElement {
  const form = el('div', 'form');

  const query = inputRow('Search', options.query, (v) => {
    options.query = v;
    scheduleSearch();
  });
  query.input.placeholder = 'Find in workspace…';

  const toggles = el('div', 'toggles');
  toggles.appendChild(
    toggle('case-sensitive', 'Match case', options.caseSensitive, (v) => {
      options.caseSensitive = v;
      runSearch();
    }),
  );
  toggles.appendChild(
    toggle('whole-word', 'Match whole word', options.wholeWord, (v) => {
      options.wholeWord = v;
      runSearch();
    }),
  );
  toggles.appendChild(
    toggle('regex', 'Use regular expression', options.isRegex, (v) => {
      options.isRegex = v;
      runSearch();
    }),
  );
  query.row.appendChild(toggles);
  form.appendChild(query.row);

  // Context controls (grep -A / -B / -C). Clicking into a group makes it the
  // active one; the other group is grayed out and ignored (not reset).
  const ctx = el('div', 'context-row');
  const before = numberField('Before (-B)', options.contextBefore, (v) => {
    options.contextBefore = v;
    setContextMode('split');
    runSearch();
  });
  const after = numberField('After (-A)', options.contextAfter, (v) => {
    options.contextAfter = v;
    setContextMode('split');
    runSearch();
  });
  const both = numberField('Both (-C)', options.contextBoth, (v) => {
    options.contextBoth = v;
    setContextMode('both');
    runSearch();
  });
  before.input.onfocus = () => setContextMode('split');
  after.input.onfocus = () => setContextMode('split');
  both.input.onfocus = () => setContextMode('both');
  beforeInput = before.input;
  afterInput = after.input;
  bothInput = both.input;
  ctx.appendChild(before.wrap);
  ctx.appendChild(after.wrap);
  ctx.appendChild(both.wrap);
  form.appendChild(ctx);

  contextHint = el('div', 'hint');
  form.appendChild(contextHint);

  // Glob scope.
  const inc = inputRow('files to include', options.includeGlobs.join(', '), (v) => {
    options.includeGlobs = splitGlobs(v);
    scheduleSearch();
  });
  inc.input.placeholder = 'files to include, e.g. src/**/*.ts';
  form.appendChild(inc.row);

  const exc = inputRow('files to exclude', options.excludeGlobs.join(', '), (v) => {
    options.excludeGlobs = splitGlobs(v);
    scheduleSearch();
  });
  exc.input.placeholder = 'files to exclude, e.g. **/node_modules/**';
  form.appendChild(exc.row);

  syncContextDisabled();
  return form;
}

/** Switch the active context group, if it actually changes, and re-search. */
function setContextMode(mode: 'both' | 'split'): void {
  if (options.contextMode === mode) {
    return;
  }
  options.contextMode = mode;
  syncContextDisabled();
  runSearch();
}

/** Gray out (but keep editable) whichever context group is inactive. */
function syncContextDisabled(): void {
  const splitActive = options.contextMode === 'split';
  beforeInput.parentElement?.classList.toggle('ignored', !splitActive);
  afterInput.parentElement?.classList.toggle('ignored', !splitActive);
  bothInput.parentElement?.classList.toggle('ignored', splitActive);
  contextHint.textContent = splitActive
    ? 'Using Before/After. Click Both (-C) to switch.'
    : 'Using Both (-C). Click Before or After to switch.';
}

// --- dynamic regions ---

function refreshActions(): void {
  actionsHost.replaceChildren(buildActions());
}

function refreshResults(): void {
  navItems = [];
  resultsHost.replaceChildren(buildResults());
  clampActive();
  applyActive(false);
}

function buildActions(): HTMLElement {
  const bar = el('div', 'actions');
  const count = selected.size;

  const status = el('span', 'status');
  status.appendChild(statusContent());
  bar.appendChild(status);

  const right = el('div', 'actions-right');
  const openBtn = el('button', 'btn primary') as HTMLButtonElement;
  openBtn.innerHTML = `<i class="codicon codicon-split-horizontal"></i> ${count ? `Open ${count} in grid` : 'Open in grid'}`;
  openBtn.disabled = count === 0;
  openBtn.title = 'Open selected matches side-by-side, each at its match';
  openBtn.onclick = openGrid;
  right.appendChild(openBtn);

  if (count) {
    const clearBtn = el('button', 'btn') as HTMLButtonElement;
    clearBtn.textContent = 'Clear';
    clearBtn.onclick = () => {
      selected.clear();
      refreshResults();
      refreshActions();
    };
    right.appendChild(clearBtn);
  }
  bar.appendChild(right);
  return bar;
}

function statusContent(): HTMLElement {
  const span = el('span', 'status-inner');
  if (searching) {
    span.innerHTML = `<i class="codicon codicon-loading codicon-modifier-spin"></i> Searching…`;
    return span;
  }
  if (model.totalMatches) {
    const files = model.files.length;
    span.textContent =
      `${model.totalMatches} match${model.totalMatches === 1 ? '' : 'es'} in ` +
      `${files} file${files === 1 ? '' : 's'}${model.truncated ? ' (truncated)' : ''}`;
  } else {
    span.textContent = '';
  }
  return span;
}

function buildResults(): HTMLElement {
  const container = el('div', 'results');
  if (model.files.length === 0) {
    const empty = el('div', 'empty');
    empty.textContent = options.query.trim() ? (searching ? 'Searching…' : 'No results.') : 'Type to search.';
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
  const name = el('span', 'file-name');
  name.textContent = file.relPath;
  header.appendChild(name);
  const badge = el('span', 'file-count');
  const matches = file.blocks.reduce((n, b) => n + b.lines.filter((l) => l.isMatch).length, 0);
  badge.textContent = String(matches);
  badge.title = `${matches} match${matches === 1 ? '' : 'es'} in this file`;
  header.appendChild(badge);
  wrap.appendChild(header);

  for (const block of file.blocks) {
    wrap.appendChild(renderBlock(block));
  }
  return wrap;
}

function renderBlock(block: MatchBlock): HTMLElement {
  const wrap = el('div', `block${selected.has(block.id) ? ' selected' : ''}`);
  wrap.dataset.blockId = block.id;
  wrap.title = 'Click to select · Double-click to open';

  const firstNavIndex = navItems.length;

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
      const column = line.matches?.[0]?.startCol ?? 0;
      navItems.push({ blockId: block.id, fileUri: block.fileUri, lineNumber: line.lineNumber, column, el: row });
    }
    code.appendChild(row);
  }
  wrap.appendChild(code);

  // Single click toggles selection; double-click opens. A short timer keeps the
  // double-click from also toggling selection.
  let clickTimer: number | undefined;
  wrap.onclick = () => {
    if (clickTimer !== undefined) {
      return;
    }
    clickTimer = window.setTimeout(() => {
      clickTimer = undefined;
      activeIndex = firstNavIndex;
      applyActive(false);
      toggleSelection(block.id, !selected.has(block.id));
    }, 200);
  };
  wrap.ondblclick = () => {
    if (clickTimer !== undefined) {
      window.clearTimeout(clickTimer);
      clickTimer = undefined;
    }
    openMatch(block.fileUri, block.anchorLine, block.anchorColumn);
  };

  return wrap;
}

function toggleSelection(blockId: string, on: boolean): void {
  if (on) {
    selected.add(blockId);
  } else {
    selected.delete(blockId);
  }
  const blockEl = resultsHost.querySelector<HTMLElement>(
    `.block[data-block-id="${cssEscape(blockId)}"]`,
  );
  blockEl?.classList.toggle('selected', on);
  refreshActions();
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

function openMatch(fileUri: string, anchorLine: number, anchorColumn: number): void {
  vscode.postMessage({ type: 'openMatch', fileUri, anchorLine, anchorColumn });
}

// --- keyboard navigation ---

function clampActive(): void {
  if (navItems.length === 0) {
    activeIndex = -1;
  } else if (activeIndex >= navItems.length) {
    activeIndex = navItems.length - 1;
  }
}

function applyActive(scroll: boolean): void {
  for (const item of navItems) {
    item.el.classList.remove('active');
  }
  if (activeIndex >= 0 && activeIndex < navItems.length) {
    const item = navItems[activeIndex];
    item.el.classList.add('active');
    if (scroll) {
      item.el.scrollIntoView({ block: 'nearest' });
    }
  }
}

function moveActive(delta: number): void {
  if (navItems.length === 0) {
    return;
  }
  if (activeIndex < 0) {
    activeIndex = delta > 0 ? 0 : navItems.length - 1;
  } else {
    activeIndex = Math.min(navItems.length - 1, Math.max(0, activeIndex + delta));
  }
  applyActive(true);
}

function isTypingTarget(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

document.addEventListener('keydown', (e) => {
  if (isTypingTarget(e.target)) {
    return;
  }
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      moveActive(1);
      break;
    case 'ArrowUp':
      e.preventDefault();
      moveActive(-1);
      break;
    case 'Enter':
      if (activeIndex >= 0) {
        e.preventDefault();
        const it = navItems[activeIndex];
        openMatch(it.fileUri, it.lineNumber, it.column);
      }
      break;
    case ' ':
      if (activeIndex >= 0) {
        e.preventDefault();
        const id = navItems[activeIndex].blockId;
        toggleSelection(id, !selected.has(id));
      }
      break;
  }
});

// --- small DOM helpers ---

function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  return node;
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && CSS.escape) {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
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

function toggle(icon: string, title: string, active: boolean, onToggle: (v: boolean) => void): HTMLElement {
  const b = el('button', `mini-toggle${active ? ' active' : ''}`);
  b.innerHTML = `<i class="codicon codicon-${icon}"></i>`;
  b.title = title;
  b.setAttribute('aria-pressed', String(active));
  b.onclick = () => {
    const next = !b.classList.contains('active');
    b.classList.toggle('active', next);
    b.setAttribute('aria-pressed', String(next));
    onToggle(next);
  };
  return b;
}

function numberField(
  label: string,
  value: number,
  onChange: (v: number) => void,
): { wrap: HTMLElement; input: HTMLInputElement } {
  const wrap = el('label', 'num-field');
  const span = el('span', 'num-label');
  span.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.value = String(value);
  input.onchange = () => onChange(Math.max(0, parseInt(input.value, 10) || 0));
  wrap.appendChild(span);
  wrap.appendChild(input);
  return { wrap, input };
}

// --- host messages ---

window.addEventListener('message', (event: MessageEvent) => {
  const msg = event.data;
  switch (msg.type) {
    case 'results':
      model = msg.model as SearchModel;
      if (msg.done) {
        searching = false;
      }
      pruneSelection();
      refreshActions();
      refreshResults();
      break;
    case 'error':
      searching = false;
      model = { files: [], truncated: false, totalMatches: 0 };
      refreshActions();
      refreshResults();
      showError(msg.message as string);
      break;
    case 'config':
      if (!vscode.getState<PersistState>()) {
        options.contextBoth = msg.defaultContextLines as number;
        bothInput.value = String(options.contextBoth);
        syncContextDisabled();
      }
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
  resultsHost.prepend(banner);
}

// --- bootstrap (build the static shell once) ---
restore();
app.appendChild(buildForm());
app.appendChild(actionsHost);
app.appendChild(resultsHost);
refreshActions();
refreshResults();
