import readline from 'node:readline/promises';
import fs from 'node:fs/promises';
import path from 'node:path';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function run(): Promise<void> {
  console.log('--- New Post ---\n');

  const title = (await rl.question('Title: ')).trim();
  if (!title) throw new Error('Title is required.');

  const description = (await rl.question('Description: ')).trim();
  const tagsRaw = (await rl.question('Tags (comma-separated): ')).trim();
  const defaultSlug = toSlug(title);
  const slugInput = (await rl.question(`Slug [${defaultSlug}]: `)).trim();

  rl.close();

  const slug = slugInput || defaultSlug;
  const tags = tagsRaw
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const date = new Date().toISOString().split('T')[0];
  const filename = `${date}-${slug}.md`;
  const filePath = path.join('posts', filename);

  const content = `---
title: "${title}"
date: ${date}
description: "${description}"
tags: [${tags.join(', ')}]
draft: false
---

Your content here.
`;

  await fs.mkdir('posts', { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');

  console.log(`\nCreated: ${filePath}`);
  console.log('Edit the file, then: git add posts/ && git commit -m "add: <title>"');
}

run().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
