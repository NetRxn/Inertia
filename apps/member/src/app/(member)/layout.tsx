import { requireMember } from '../../identity/session';
import { Suspense } from 'react';

async function AuthGuard({ children }: { children: React.ReactNode }) {
  // This will redirect to /login if not authenticated
  await requireMember();
  return <>{children}</>;
}

export default function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AuthGuard>{children}</AuthGuard>
    </Suspense>
  );
}
