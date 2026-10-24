import { requireMember } from '../../identity/session';

export default async function MemberLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // This will redirect to /login if not authenticated
  await requireMember();

  return <>{children}</>;
}
