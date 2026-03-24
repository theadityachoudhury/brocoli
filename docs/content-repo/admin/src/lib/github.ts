const BASE = 'https://api.github.com';
const token = import.meta.env.VITE_GITHUB_TOKEN as string;
const owner = import.meta.env.VITE_GITHUB_OWNER as string;
const repo = import.meta.env.VITE_GITHUB_REPO as string;
const branch = (import.meta.env.VITE_GITHUB_BRANCH as string | undefined) ?? 'main';

function headers(): Record<string, string> {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

function encode(content: string): string {
  const bytes = new TextEncoder().encode(content);
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
}

function decode(base64: string): string {
  const bytes = Uint8Array.from(atob(base64.replace(/\n/g, '')), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function rawUrl(filename: string): string {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/posts/${filename}`;
}

async function getFileSha(path: string): Promise<string | null> {
  const res = await fetch(`${BASE}/repos/${owner}/${repo}/contents/${path}`, {
    headers: headers(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub error ${res.status}`);
  const data = (await res.json()) as { sha: string };
  return data.sha;
}

export async function getFileContent(filename: string): Promise<string> {
  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/contents/posts/${filename}`,
    { headers: headers() },
  );
  if (!res.ok) throw new Error(`GitHub fetch failed: ${res.status}`);
  const data = (await res.json()) as { content: string };
  return decode(data.content);
}

export async function createFile(
  filename: string,
  content: string,
  message: string,
): Promise<void> {
  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/contents/posts/${filename}`,
    {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ message, content: encode(content), branch }),
    },
  );
  if (!res.ok) throw new Error(`GitHub create failed: ${res.status} ${await res.text()}`);
}

export async function updateFile(
  filename: string,
  content: string,
  message: string,
): Promise<void> {
  const sha = await getFileSha(`posts/${filename}`);
  if (!sha) throw new Error(`File not found: posts/${filename}`);

  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/contents/posts/${filename}`,
    {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ message, content: encode(content), sha, branch }),
    },
  );
  if (!res.ok) throw new Error(`GitHub update failed: ${res.status} ${await res.text()}`);
}

export async function deleteFile(filename: string, message: string): Promise<void> {
  const sha = await getFileSha(`posts/${filename}`);
  if (!sha) return; // already gone

  const res = await fetch(
    `${BASE}/repos/${owner}/${repo}/contents/posts/${filename}`,
    {
      method: 'DELETE',
      headers: headers(),
      body: JSON.stringify({ message, sha, branch }),
    },
  );
  if (!res.ok) throw new Error(`GitHub delete failed: ${res.status} ${await res.text()}`);
}
