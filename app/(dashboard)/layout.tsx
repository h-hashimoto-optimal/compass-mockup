import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/common/sidebar';
import { Header } from '@/components/common/header';
import { RoleProvider } from '@/components/common/role-context';
import { getSession } from '@/lib/auth';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();
  if (!user) redirect('/login');

  return (
    <RoleProvider user={user}>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-6 bg-muted/30">{children}</main>
        </div>
      </div>
    </RoleProvider>
  );
}
