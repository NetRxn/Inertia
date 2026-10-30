import React, { useEffect, useState, type CSSProperties } from 'react';
import type { PluginDetailTabProps } from '@paperclipai/plugin-sdk/ui';
import { usePluginAction } from '@paperclipai/plugin-sdk/ui';
import { parseTaskTrailResponse, type TaskTrailResponse } from './org-client.js';

const card: CSSProperties = {
  border: '1px solid var(--border, #d4d4d8)',
  borderRadius: 8,
  padding: '0.8rem 1rem',
  background: 'var(--background, transparent)',
};

const mutedText: CSSProperties = {
  color: 'var(--muted-text, #71717a)',
};

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: { kind: string; message?: string } };

export function TaskTrailTab({ context }: PluginDetailTabProps) {
  if (context.entityType !== 'issue') return null;

  const [data, setData] = useState<TaskTrailResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const trailAction = usePluginAction('org.task.trail');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const result = (await trailAction({ issueId: context.entityId })) as ActionResult<TaskTrailResponse>;
        if (!result.ok) {
          if (result.error.kind === 'forbidden') {
            setError('You\'re not a member of this DAO yet.');
          } else {
            setError(result.error.message || 'Could not load task trail.');
          }
          setData(null);
        } else {
          setData(parseTaskTrailResponse(result.data));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load task trail.');
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [context.entityId]);

  if (loading) {
    return <p role="status">Loading…</p>;
  }

  if (error) {
    return <p role="alert">{error}</p>;
  }

  if (!data) {
    return null;
  }

  return (
    <section style={{ display: 'grid', gap: '1rem', maxWidth: 880 }}>
      <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{data.title}</h2>
      <p style={{ margin: 0 }}>{data.status}</p>

      {data.assignee && (
        <div style={card}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 600 }}>Assigned to</h3>
          <p style={{ margin: 0 }}>{data.assignee}</p>
        </div>
      )}

      {data.doneWhen && (
        <div style={card}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 600 }}>Done when</h3>
          <p style={{ margin: 0 }}>{data.doneWhen}</p>
        </div>
      )}

      {data.nextStep && (
        <div style={card}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 600 }}>Next step</h3>
          <p style={{ margin: 0 }}>{data.nextStep}</p>
        </div>
      )}

      <details>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Why this exists · {data.trail.summary}
        </summary>
        {data.trail.steps.length > 0 && (
          <ol style={{ marginTop: '0.8rem', paddingLeft: '1.5rem' }}>
            {data.trail.steps.map((step, i) => (
              <li key={i} style={step.available ? {} : mutedText}>
                <strong>{step.label}:</strong> {step.detail}
              </li>
            ))}
          </ol>
        )}
        {data.trail.alsoUsed.length > 0 && (
          <p style={{ marginTop: '0.8rem' }}>
            <strong>Also used:</strong> {data.trail.alsoUsed.join(', ')}
          </p>
        )}
      </details>
    </section>
  );
}
