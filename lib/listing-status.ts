// 出品の「表示ステータス」を、ローカル段階(status)＋Coupang承認/販売から導出する単一ソース。
// Coupangは「登録(承認)」と「販売」が別レイヤーなので、1つのバッジに潰さず正しく言い分ける。
export type StatusTone = 'muted' | 'info' | 'success' | 'warning' | 'destructive';
export type StatusView = { label: string; tone: StatusTone; hint?: string };

export type ListingStatusInput = {
  status: string;
  coupangApprovalStatus?: string | null;
  coupangSalesStatus?: string | null;
};

export function listingStatusView(s: ListingStatusInput): StatusView {
  const ap = s.coupangApprovalStatus ?? null;
  const sl = s.coupangSalesStatus ?? null;

  switch (s.status) {
    case 'draft':
      return { label: '未処理', tone: 'muted', hint: '受信トレイに入った直後（翻訳・価格計算前）' };
    case 'ready':
      return { label: '送信待ち', tone: 'info', hint: '翻訳・価格計算済み。まだCoupangに送信していない' };
    case 'error':
      return { label: 'エラー', tone: 'destructive', hint: 'Coupangへの送信に失敗' };
    case 'submitted': {
      if (ap === 'rejected') return { label: '却下', tone: 'destructive', hint: 'Coupang審査で却下（반려）' };
      if (ap === 'deleted') return { label: '削除済', tone: 'muted', hint: 'Coupang側で削除' };
      if (ap === 'requested' || ap == null)
        return { label: '審査中', tone: 'warning', hint: 'Coupangに登録要求済み・承認待ち（승인대기）' };
      // approved / partial_approved
      if (sl === 'on_sale') return { label: '販売中', tone: 'success', hint: 'Coupangで販売中（판매중）' };
      if (sl === 'suspended') return { label: '販売停止', tone: 'warning', hint: '판매중지' };
      if (sl === 'soldout') return { label: '品切れ', tone: 'muted', hint: '품절' };
      return {
        label: ap === 'partial_approved' ? '一部承認' : '承認済み',
        tone: 'info',
        hint: '承認済み（販売開始前）',
      };
    }
    default:
      return { label: s.status, tone: 'muted' };
  }
}
