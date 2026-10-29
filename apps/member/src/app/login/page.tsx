'use client';

import { useState, FormEvent } from 'react';
import styles from './login.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [byAdmin, setByAdmin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/request-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json().catch(() => ({}))) as { delivery?: string };

      // Always show the same response
      setByAdmin(body.delivery === 'admin');
      setSubmitted(true);
    } catch (error) {
      console.error('Error requesting login link:', error);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <p className={styles.message}>
            {byAdmin
              ? "Inertia doesn't send email yet. Ask an admin of your organization for your sign-in link; it works once."
              : 'Check your email for a sign-in link.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in to Inertia</h1>
        <p className={styles.description}>Enter your email to receive a sign-in link</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={styles.input}
              placeholder="you@example.org"
              disabled={isSubmitting}
            />
          </div>

          <button type="submit" className={styles.button} disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send sign-in link'}
          </button>
        </form>
      </div>
      <a href="/story" className={styles.story}>
        New here? Take the short tour
      </a>
    </div>
  );
}
