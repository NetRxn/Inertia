/** Reads public GitHub repositories (description, topics and README) as text for org memory. */

export type RepoPage = { url: string; title: string; text: string };

const MAX_REPOS = 25;
const MAX_README_CHARS = 60_000;

type Repo = { full_name: string; name: string; html_url: string; description: string | null; topics?: string[]; default_branch: string; archived?: boolean; fork?: boolean; pushed_at?: string };

/** "FWTX-DAO", "https://github.com/FWTX-DAO" or "owner/repo" lines → an org and/or explicit repos. */
export function parseGithubInput(input: string): { org: string | null; repos: string[] } {
  let org: string | null = null;
  const repos: string[] = [];
  for (const raw of input.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)) {
    const path = raw.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\.git$/, '').replace(/\/+$/, '');
    const parts = path.split('/').filter(Boolean);
    const valid = (s: string) => /^[A-Za-z0-9_.-]{1,100}$/.test(s) && !/^\.+$/.test(s);
    if (parts.length === 1 && valid(parts[0])) org ??= parts[0];
    else if (parts.length >= 2 && valid(parts[0]) && valid(parts[1])) repos.push(`${parts[0]}/${parts[1]}`);
  }
  return { org, repos: Array.from(new Set(repos)) };
}

async function json<T>(fetchImpl: typeof fetch, url: string): Promise<T | null> {
  const response = await fetchImpl(url, { headers: { accept: 'application/vnd.github+json', 'user-agent': 'inertia-member-app' }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  return response?.ok ? ((await response.json()) as T) : null;
}

async function readme(fetchImpl: typeof fetch, repo: Repo): Promise<string> {
  for (const name of ['README.md', 'readme.md', 'README', 'Readme.md']) {
    const response = await fetchImpl(`https://raw.githubusercontent.com/${repo.full_name}/${encodeURIComponent(repo.default_branch)}/${name}`, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (response?.ok) return (await response.text()).slice(0, MAX_README_CHARS);
  }
  return '';
}

/**
 * Lists an organization's public repositories (most recently pushed first,
 * skipping forks and archived ones) plus any named repositories, and reads each.
 */
export async function readGithub(input: string, fetchImpl: typeof fetch = fetch): Promise<RepoPage[]> {
  const { org, repos } = parseGithubInput(input);
  const found: Repo[] = [];
  if (org) {
    const list = await json<Repo[]>(fetchImpl, `https://api.github.com/orgs/${org}/repos?per_page=100&type=public&sort=pushed`)
      ?? await json<Repo[]>(fetchImpl, `https://api.github.com/users/${org}/repos?per_page=100&sort=pushed`);
    for (const repo of list ?? []) if (!repo.fork && !repo.archived) found.push(repo);
  }
  for (const fullName of repos) {
    if (found.some((r) => r.full_name.toLowerCase() === fullName.toLowerCase())) continue;
    const repo = await json<Repo>(fetchImpl, `https://api.github.com/repos/${fullName}`);
    // Without the API, assume the usual default branch so a README can still be read.
    found.push(repo ?? { full_name: fullName, name: fullName.split('/')[1], html_url: `https://github.com/${fullName}`, description: null, default_branch: 'main' });
  }
  const pages: RepoPage[] = [];
  for (const repo of found.slice(0, MAX_REPOS)) {
    const body = await readme(fetchImpl, repo);
    const text = [
      `Repository: ${repo.full_name}`,
      repo.description ? `Description: ${repo.description}` : null,
      repo.topics?.length ? `Topics: ${repo.topics.join(', ')}` : null,
      repo.pushed_at ? `Last updated: ${repo.pushed_at.slice(0, 10)}` : null,
      body ? `\n${body}` : null,
    ].filter(Boolean).join('\n');
    if (body || repo.description) pages.push({ url: repo.html_url, title: `GitHub: ${repo.name}`, text });
  }
  return pages;
}
