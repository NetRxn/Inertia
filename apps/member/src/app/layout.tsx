import type { Metadata } from 'next';
import { Martian_Mono, Newsreader, Schibsted_Grotesk } from 'next/font/google';
import '../../design/components/bundle.css';
import '../styles/tokens.css';
import './globals.css';

// The design system's three families, self-hosted as variable fonts (one file each,
// covering the 400–700, 400–500 and 400–500 weights the system uses). globals.css
// puts them in front of the token stacks (--font-display, --font-sans, --font-voice, --font-mono).
const grotesk = Schibsted_Grotesk({ variable: '--font-schibsted', subsets: ['latin'] });
const newsreader = Newsreader({ variable: '--font-newsreader', subsets: ['latin'], style: 'italic', axes: ['opsz'] });
const martian = Martian_Mono({ variable: '--font-martian', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Inertia',
  description: 'What is happening in the DAO, and where you can help.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${grotesk.variable} ${newsreader.variable} ${martian.variable}`}>
      <body>{children}</body>
    </html>
  );
}
