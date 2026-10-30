import { Suspense } from 'react';
import { requireMember } from '../../identity/session';
import { FloatingMenu } from '../../components/FloatingMenu';
import { ChatBar } from '../../components/ChatBar';
import styles from './layout.module.css';

async function AuthGuard({ children }: { children: React.ReactNode }) {
  // Redirects to /login when there is no signed-in member.
  await requireMember();
  return <>{children}</>;
}

/**
 * The member shell: the floating section menu, a centered column for the page,
 * and the chat bar pinned to the bottom. Signing out lives on Profile.
 */
export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`in-tex in-tex--grain ${styles.shell}`}>
      <div className={styles.lights} aria-hidden="true">
        <span className={styles.lightSignal} />
        <span className={styles.lightTide} />
      </div>
      <FloatingMenu />
      <main className={styles.column}>
        <Suspense fallback={<p className="in-mono">Loading…</p>}>
          <AuthGuard>{children}</AuthGuard>
        </Suspense>
      </main>
      <ChatBar />
    </div>
  );
}
