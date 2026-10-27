import { describe, it, expect } from 'vitest';
import { parseGithubInput, readGithub } from '../src/org/github';

describe('GitHub reading', () => {
  it('understands an org, URLs and owner/repo lines', () => {
    expect(parseGithubInput('FWTX-DAO')).toEqual({ org: 'FWTX-DAO', repos: [] });
    expect(parseGithubInput('https://github.com/FWTX-DAO/website.git\nFWTX-DAO/dao-platform, https://github.com/FWTX-DAO/website')).toEqual({ org: null, repos: ['FWTX-DAO/website', 'FWTX-DAO/dao-platform'] });
    expect(parseGithubInput('../../etc passwd')).toEqual({ org: 'passwd', repos: [] });
  });

  it('lists an org, skips forks and archives, and reads READMEs', async () => {
    const asked: string[] = [];
    const fetchImpl = (async (input: string | URL) => {
      const url = String(input);
      asked.push(url);
      if (url.startsWith('https://api.github.com/orgs/FWTX-DAO/repos')) {
        return new Response(JSON.stringify([
          { full_name: 'FWTX-DAO/website', name: 'website', html_url: 'https://github.com/FWTX-DAO/website', description: 'The DAO website', topics: ['astro'], default_branch: 'main', pushed_at: '2026-10-20T00:00:00Z' },
          { full_name: 'FWTX-DAO/fork', name: 'fork', html_url: 'x', description: 'f', default_branch: 'main', fork: true },
          { full_name: 'FWTX-DAO/old', name: 'old', html_url: 'x', description: 'o', default_branch: 'main', archived: true },
        ]));
      }
      if (url === 'https://raw.githubusercontent.com/FWTX-DAO/website/main/README.md') return new Response('# Website\nBuilt with Astro.');
      return new Response('not found', { status: 404 });
    }) as typeof fetch;
    const pages = await readGithub('FWTX-DAO', fetchImpl);
    expect(pages).toEqual([{ url: 'https://github.com/FWTX-DAO/website', title: 'GitHub: website', text: expect.stringContaining('Description: The DAO website') }]);
    expect(pages[0].text).toContain('Built with Astro.');
    expect(pages[0].text).toContain('Topics: astro');
    expect(asked.some((u) => u.includes('/fork/'))).toBe(false);
  });

  it('still reads a named repo when the API is unavailable', async () => {
    const fetchImpl = (async (input: string | URL) => String(input).startsWith('https://raw.githubusercontent.com/FWTX-DAO/website/main/README.md') ? new Response('# Website') : new Response('', { status: 403 })) as typeof fetch;
    expect(await readGithub('FWTX-DAO/website', fetchImpl)).toEqual([{ url: 'https://github.com/FWTX-DAO/website', title: 'GitHub: website', text: expect.stringContaining('# Website') }]);
  });
});
