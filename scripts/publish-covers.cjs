#!/usr/bin/env node
/**
 * Publish the generated covers from D:\Murshid Covers to the public covers repo.
 *
 * Only Word documents at the folder root and their preview images in
 * "previews/" are uploaded. The template (cover.docx) and the source PDFs stay
 * local.
 *
 * Requires an authenticated git remote (the developer machine only).
 * Usage: node scripts/publish-covers.cjs
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SOURCE = process.argv[2] || 'D:\\Murshid Covers';
const REPO = 'https://github.com/jalalamanj1/murshidcovers.git';
const TEMPLATE = 'cover.docx';
const BRANCH = 'main';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' }).trim();
}

if (!fs.existsSync(SOURCE)) throw new Error(`Folder not found: ${SOURCE}`);

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'murshid-covers-publish-'));
try {
  git(['clone', REPO, work]);
  try {
    git(['checkout', BRANCH], work);
  } catch {
    git(['checkout', '-b', BRANCH], work);
  }

  let copied = 0;

  // Word documents
  for (const name of fs.readdirSync(SOURCE)) {
    if (!name.toLowerCase().endsWith('.docx')) continue;
    if (name.toLowerCase() === TEMPLATE.toLowerCase()) continue;
    fs.copyFileSync(path.join(SOURCE, name), path.join(work, name));
    copied += 1;
  }

  // Preview images
  const previews = path.join(SOURCE, 'previews');
  if (fs.existsSync(previews)) {
    fs.mkdirSync(path.join(work, 'previews'), { recursive: true });
    for (const name of fs.readdirSync(previews)) {
      if (!/\.(jpg|jpeg|png)$/i.test(name)) continue;
      fs.copyFileSync(path.join(previews, name), path.join(work, 'previews', name));
      copied += 1;
    }
  }

  const status = git(['status', '--porcelain'], work);
  if (!status) {
    console.log('Nothing to publish — the repository is already up to date.');
  } else {
    git(['add', '-A'], work);
    git(
      [
        '-c',
        'user.name=Murshid Publisher',
        '-c',
        'user.email=noreply@murshid.local',
        'commit',
        '-m',
        `Publish covers ${new Date().toISOString().slice(0, 19)}`,
      ],
      work
    );
    git(['push', 'origin', BRANCH], work);
    console.log(`Published ${copied} files to ${REPO} (${BRANCH}).`);
  }
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
