import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatText } from '../src/components/ChatText';

describe('ChatText', () => {
  it('renders light Markdown as elements', () => {
    const html = renderToStaticMarkup(<ChatText text={'## Roundtables\n\nThey meet **Wednesdays at 12pm** at `CreateFW`.\n\n- Open door\n- Weekly\n\n1. First\n2. Second'} />);
    expect(html).toBe('<div><p><strong>Roundtables</strong></p><p>They meet <strong>Wednesdays at 12pm</strong> at <code>CreateFW</code>.</p><ul><li>Open door</li><li>Weekly</li></ul><ol><li>First</li><li>Second</li></ol></div>');
  });

  it('never turns model text into HTML', () => {
    const html = renderToStaticMarkup(<ChatText text={'<img src=x onerror=alert(1)> **<b>hi</b>**'} />);
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('<strong>&lt;b&gt;hi&lt;/b&gt;</strong>');
  });
});
