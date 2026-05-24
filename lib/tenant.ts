// テナント・スコープの単一窓口。テナント業務データは必ずここ経由で tenant_id を確定する。
// owner（本部）はテナント業務データの主体ではない（将来は代理ログインで対象テナントを指定）。
import { getSession } from '@/lib/auth';

// 現在のリクエストの「操作対象テナントID」。無ければ null（=テナント業務不可）。
export async function currentTenantId(): Promise<string | null> {
  const s = await getSession();
  if (!s) return null;
  if (s.role === 'owner') return null; // 本部は加盟店データの主体でない
  return s.tenantId && s.tenantId !== 'HQ' ? s.tenantId : null;
}

// テナント文脈が必須のAPIで使用。無ければ例外。
export async function requireTenantId(): Promise<string> {
  const id = await currentTenantId();
  if (!id) throw new Error('NO_TENANT_CONTEXT');
  return id;
}
