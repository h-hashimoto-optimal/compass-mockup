'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';
import {
  LayoutDashboard,
  Inbox,
  ListChecks,
  Send,
  ShoppingBag,
  Settings,
  Building2,
  Coins,
  Plug,
  ChevronDown,
  Chrome,
  Ban,
  ShieldBan,
  ShieldAlert,
  Siren,
} from 'lucide-react';
import { useRole } from '@/components/common/role-context';
import { cn } from '@/lib/utils';

type NavItem = {
  href?: string;
  label: string;
  icon: React.ElementType;
  children?: { href: string; label: string; icon?: React.ElementType }[];
  ownerOnly?: boolean;
};

const items: NavItem[] = [
  { href: '/', label: 'HOME', icon: LayoutDashboard },
  { href: '/products', label: 'ASIN受信トレイ', icon: Inbox },
  {
    label: '管理',
    icon: ListChecks,
    children: [
      { href: '/listings', label: '出品商品管理', icon: ListChecks },
      { href: '/publish/J-2026-04-25-0042', label: 'Coupang一括出品', icon: Send },
      { href: '/alerts', label: '在庫・損益監視', icon: Siren },
    ],
  },
  { href: '/orders', label: '受注', icon: ShoppingBag },
  {
    label: '各種設定',
    icon: Settings,
    children: [
      { href: '/settings/source', label: '仕入元（Amazon）', icon: Chrome },
      { href: '/settings/channels', label: '販売先（Coupang）', icon: Plug },
      { href: '/settings/margin', label: '利益', icon: Coins },
      { href: '/settings/ng-words', label: '禁止ワード辞書', icon: Ban },
      { href: '/settings/blacklist', label: 'ASINブラックリスト', icon: ShieldBan },
      { href: '/settings/ip-brands', label: '知財警告ブランドDB', icon: ShieldAlert },
      { href: '/settings/monitoring', label: '在庫・損益監視', icon: Siren },
    ],
  },
  {
    label: '本部専用',
    icon: Building2,
    ownerOnly: true,
    children: [{ href: '/admin/tenants', label: '加盟店', icon: Building2 }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useRole();
  const [open, setOpen] = React.useState<Record<string, boolean>>({
    管理: true,
    各種設定: false,
    本部専用: true,
  });

  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r bg-secondary text-secondary-foreground">
      <div className="flex items-center gap-2 px-5 h-14 border-b border-white/10">
        <div className="grid place-items-center h-7 w-7 rounded-md bg-primary text-primary-foreground font-bold text-sm">
          C
        </div>
        <span className="font-semibold tracking-tight">Compass</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
        <ul className="space-y-0.5 px-2">
          {items.map((item) => {
            if (item.ownerOnly && role !== 'owner') return null;
            const Icon = item.icon;
            if (item.children) {
              const isOpen = open[item.label] ?? false;
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() =>
                      setOpen((s) => ({ ...s, [item.label]: !isOpen }))
                    }
                    className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.ownerOnly && (
                      <span className="text-[9px] uppercase rounded bg-primary/20 text-primary px-1 py-0.5">
                        owner
                      </span>
                    )}
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 transition-transform',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>
                  {isOpen && (
                    <ul className="mt-0.5 mb-2 space-y-0.5 pl-3">
                      {item.children.map((c) => {
                        const CIcon = c.icon ?? Icon;
                        const active = pathname === c.href;
                        return (
                          <li key={c.href}>
                            <Link
                              href={c.href}
                              className={cn(
                                'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm text-white/70 hover:bg-white/5 hover:text-white',
                                active &&
                                  'bg-primary/15 text-white border-l-2 border-primary',
                              )}
                            >
                              <CIcon className="h-3.5 w-3.5" />
                              <span>{c.label}</span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            }
            const active = pathname === item.href;
            return (
              <li key={item.label}>
                <Link
                  href={item.href ?? '#'}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/5 hover:text-white',
                    active && 'bg-primary/20 text-white',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t border-white/10 p-3 text-[11px] text-white/50 leading-relaxed">
        <div>
          {role === 'owner' ? '本部モード' : '加盟店モード'}
        </div>
      </div>
    </aside>
  );
}
