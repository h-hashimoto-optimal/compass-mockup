'use client';

import { LogOut, Building2, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRole } from '@/components/common/role-context';

export function Header() {
  const { user, role, signOut } = useRole();
  const RoleIcon = role === 'owner' ? Building2 : Store;
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur px-4">
      <div className="flex items-center gap-2">
        <RoleIcon className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{user.tenantName}</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div className="ml-1 flex items-center gap-2 pl-2 border-l">
          <div className="h-7 w-7 rounded-full bg-muted grid place-items-center">
            <RoleIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <div className="hidden md:block text-xs leading-tight">
            <div className="font-medium">{user.fullName}</div>
            <div className="text-muted-foreground">{user.email}</div>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="ログアウト"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
