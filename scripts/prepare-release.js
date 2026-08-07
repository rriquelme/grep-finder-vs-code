// Promotes the "## [Unreleased]" section of CHANGELOG.md to a real version
// heading and writes that section's body out as GitHub Release notes.
//
// Used by .github/workflows/auto-release.yml, but safe to run by hand:
//   node scripts/prepare-release.js 0.1.1 notes.md [fallback-notes.md]
//
// If there is no "## [Unreleased]" section, or it is empty, a new section is
// inserted using the fallback notes (the workflow passes the commit subjects
// since the last tag) so a release always carries *some* description.
const fs = require('node:fs');
const path = require('node:path');

const [, , version, notesOut, fallbackFile] = process.argv;

if (!version || !notesOut) {
  console.error('usage: prepare-release.js <version> <notes-out> [fallback-notes]');
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Not a valid semver version: ${version}`);
  process.exit(1);
}

const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
const original = fs.readFileSync(changelogPath, 'utf8');
const eol = original.includes('\r\n') ? '\r\n' : '\n';
const lines = original.split(/\r?\n/);

const isVersionHeading = (line) => /^##\s+\[/.test(line);
const unreleasedAt = lines.findIndex((line) => /^##\s+\[Unreleased\]/i.test(line));

const fallback = fallbackFile && fs.existsSync(fallbackFile)
  ? fs.readFileSync(fallbackFile, 'utf8').trim()
  : '';

let notes = '';
let updated;

if (unreleasedAt !== -1) {
  // Body runs from just after the heading to the next version heading (or EOF).
  let end = unreleasedAt + 1;
  while (end < lines.length && !isVersionHeading(lines[end])) {
    end++;
  }
  notes = lines.slice(unreleasedAt + 1, end).join(eol).trim();

  if (notes) {
    // Rename the heading in place; the body already reads as release notes.
    updated = [...lines];
    updated[unreleasedAt] = `## [${version}]`;
  } else {
    // An empty Unreleased section is a placeholder — fill it from the fallback.
    notes = fallback;
    updated = [
      ...lines.slice(0, unreleasedAt),
      `## [${version}]`,
      '',
      notes,
      '',
      ...lines.slice(end),
    ];
  }
} else {
  // No Unreleased section: insert a new one above the topmost version heading,
  // falling back to the end of the intro if the changelog has no versions yet.
  notes = fallback;
  const firstVersionAt = lines.findIndex(isVersionHeading);
  const insertAt = firstVersionAt === -1 ? lines.length : firstVersionAt;
  updated = [
    ...lines.slice(0, insertAt),
    `## [${version}]`,
    '',
    notes,
    '',
    ...lines.slice(insertAt),
  ];
}

if (!notes.trim()) {
  notes = `Maintenance release ${version}.`;
}

fs.writeFileSync(changelogPath, updated.join(eol));
fs.writeFileSync(notesOut, `${notes.trim()}${eol}`);

console.log(`CHANGELOG.md: released section [${version}]`);
console.log(`Release notes written to ${notesOut}`);
