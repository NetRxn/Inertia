import { Suspense } from 'react';
import Link from 'next/link';
import { requireMember } from '../../../identity/session';
import cardStyles from '../../../components/cards/cards.module.css';
import styles from '../sections.module.css';

async function ProfileContent() {
  const member = await requireMember();

  return (
    <section className={`in-glass ${cardStyles.card}`} aria-labelledby="profile-you">
      <h2 id="profile-you" className={`in-label ${cardStyles.eyebrow}`}>
        You
      </h2>
      <dl className={styles.fields}>
        <dt>Name</dt>
        <dd>{member.displayName}</dd>
        <dt>Email</dt>
        <dd>{member.email}</dd>
      </dl>
      <form action="/auth/sign-out" method="POST" className={styles.profileActions}>
        <button type="submit" className="in-btn in-btn--secondary">
          Sign out
        </button>
        <Link href="/story" className="in-btn in-btn--quiet">
          What is Inertia?
        </Link>
      </form>
    </section>
  );
}

/** The member's name and email, the way out, and the short tour of the idea. */
export default function ProfilePage() {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>Profile</h1>
      </header>
      <Suspense fallback={<p className="in-mono">Loading…</p>}>
        <ProfileContent />
      </Suspense>
    </>
  );
}
