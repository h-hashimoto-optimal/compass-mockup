'use client';

import * as React from 'react';

export type Role = 'owner' | 'tenant_admin';

export type SessionUser = {
  role: Role;
  fullName: string;
  email: string;
  tenantName: string; // 自モール名
  tenantId: string;
};

const RoleContext = React.createContext<{
  user: SessionUser;
  role: Role;
  signOut: () => void;
} | null>(null);

export function RoleProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const signOut = React.useCallback(async () => {
    await fetch('/api/auth/signout', { method: 'POST' });
    window.location.href = '/login';
  }, []);

  return (
    <RoleContext.Provider value={{ user, role: user.role, signOut }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = React.useContext(RoleContext);
  if (!ctx) {
    // Sidebar/Header外で呼ばれた時のフォールバック
    return {
      role: 'tenant_admin' as Role,
      user: {
        role: 'tenant_admin' as Role,
        fullName: '越境 隆',
        email: 'cb@optimal-biz.co.jp',
        tenantName: 'optimal shop',
        tenantId: 'T-001',
      },
      signOut: async () => {
        window.location.href = '/login';
      },
    };
  }
  return ctx;
}
