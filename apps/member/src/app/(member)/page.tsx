import { requireMember } from '../../identity/session';
import styles from './home.module.css';

export const instant = false;

export default async function HomePage() {
  const member = await requireMember();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.welcome}>Welcome, {member.displayName}</h1>
        <p className={styles.message}>More features coming soon.</p>

        <form action="/auth/sign-out" method="GET" className={styles.signOutForm}>
          <button type="submit" className={styles.signOutButton}>
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
