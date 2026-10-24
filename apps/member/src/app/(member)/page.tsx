import { requireMember } from '../../identity/session';
import styles from './home.module.css';
import { Suspense } from 'react';

async function HomeContent() {
  const member = await requireMember();

  return (
    <div className={styles.content}>
      <h1 className={styles.welcome}>Welcome, {member.displayName}</h1>
      <p className={styles.message}>More features coming soon.</p>

      <form action="/auth/sign-out" method="POST" className={styles.signOutForm}>
        <button type="submit" className={styles.signOutButton}>
          Sign out
        </button>
      </form>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className={styles.container}>
      <Suspense fallback={<div className={styles.content}>Loading...</div>}>
        <HomeContent />
      </Suspense>
    </div>
  );
}
