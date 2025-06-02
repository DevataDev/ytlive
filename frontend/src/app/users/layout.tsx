import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'User Management | YukLive!',
  description: 'Manage user accounts and permissions',
  keywords: ['users', 'management', 'permissions', 'user accounts', 'admin'],
};

export default function UsersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
