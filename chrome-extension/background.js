// 現状はプレースホルダ（content.js / popup.js のみで完結）。
// 将来：バックグラウンドで定期同期や複数タブの集約を行う場合にここで処理する。
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Compass] ASIN Collector installed');
});
