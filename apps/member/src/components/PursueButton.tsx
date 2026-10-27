'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { pursueFunding } from '../org/actions';

/** Pursue an opportunity: agents and people get their first tasks under the grant initiative. */
export function PursueButton({ opportunityId, pursued }: { opportunityId: string; pursued: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  if (pursued) return <Link className="in-btn in-btn--quiet" href="/work">Pursuing · see the work</Link>;
  return (
    <span>
      <button
        className="in-btn in-btn--primary"
        disabled={pending}
        onClick={() => start(async () => {
          const result = await pursueFunding(opportunityId);
          setMessage(result.ok ? result.message ?? null : result.error);
          if (result.ok) router.refresh();
        })}
      >
        {pending ? 'Planning the work…' : 'Pursue this'}
      </button>
      {message && <span role="status"> {message}</span>}
    </span>
  );
}
