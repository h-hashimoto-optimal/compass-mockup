// Amazon取得失敗のサーバエラー文字列を、画面表示用の原因別メッセージに変換する。
// 末尾の文脈（「登録していません」等）は呼び出し側で付ける。
export function amazonFetchErrorMessage(serverError?: string | null): string {
  const e = String(serverError ?? '');
  if (/SP_API_AUTH/.test(e)) {
    return 'Amazon連携の鍵が無効か期限切れです。仕入元連携をご確認ください。';
  }
  if (/SP_API_CATALOG/.test(e) && /\b404\b/.test(e)) {
    return 'このASINはAmazonで見つかりませんでした。';
  }
  if (/\b429\b/.test(e)) {
    return 'Amazonが混み合っています。少し時間をおいて再試行してください。';
  }
  return '商品情報を取得できませんでした。ASINをご確認ください。';
}
