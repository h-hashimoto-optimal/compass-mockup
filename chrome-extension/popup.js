// Compass ASIN Collector — popup
const STATE_KEY = 'compass:lastCapture';
const ENDPOINT_KEY = 'compass:endpoint';
const TOKEN_KEY = 'compass:token';
const DEFAULT_ENDPOINT = 'http://localhost:3000/api/ingest';

const $ = (id) => document.getElementById(id);

function setStatus(msg, kind) {
  const el = $('status');
  el.textContent = msg;
  el.className = 'status' + (kind ? ' ' + kind : '');
}

function fmtJpy(n) {
  if (n == null) return '—';
  return '¥' + n.toLocaleString('ja-JP');
}

function render(payload) {
  if (!payload) {
    $('query').textContent = '—';
    $('count').textContent = '0';
    $('capturedAt').textContent = '—';
    $('list').innerHTML = '';
    return;
  }
  $('query').textContent = payload.query || '(なし)';
  $('count').textContent = String(payload.items.length);
  $('capturedAt').textContent = new Date(payload.capturedAt).toLocaleString('ja-JP');
  const list = $('list');
  list.innerHTML = '';
  payload.items.slice(0, 10).forEach((it) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <img src="${it.imageUrl || ''}" alt="" />
      <div class="li-main">
        <div class="li-asin">${it.asin}</div>
        <div class="li-title">${escapeHtml(it.title || '(タイトル未取得)')}</div>
      </div>
      <div class="li-price">${fmtJpy(it.priceJpy)}</div>
    `;
    list.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function loadEndpoint() {
  const r = await chrome.storage.local.get([ENDPOINT_KEY]);
  let ep = r[ENDPOINT_KEY] || DEFAULT_ENDPOINT;
  // 旧グローバル受信先は廃止 → テナント別 /api/ingest へ自動移行
  if (ep.includes('/api/asins')) ep = ep.replace('/api/asins', '/api/ingest');
  return ep;
}
async function saveEndpoint(v) {
  await chrome.storage.local.set({ [ENDPOINT_KEY]: v });
}
async function loadToken() {
  const r = await chrome.storage.local.get([TOKEN_KEY]);
  return r[TOKEN_KEY] || '';
}
async function saveToken(v) {
  await chrome.storage.local.set({ [TOKEN_KEY]: v });
}

async function loadState() {
  const r = await chrome.storage.local.get([STATE_KEY]);
  return r[STATE_KEY] || null;
}

async function send() {
  const payload = await loadState();
  if (!payload || payload.items.length === 0) {
    setStatus('送信するASINがありません', 'err');
    return;
  }
  const endpoint = $('endpoint').value.trim();
  const token = $('token').value.trim();
  await saveEndpoint(endpoint);
  await saveToken(token);
  if (!token) {
    setStatus('接続トークンを入力してください（Compassの受信トレイで発行）', 'err');
    return;
  }
  setStatus(`送信中... ${payload.items.length}件 → ${endpoint}`);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Compass-Token': token },
      body: JSON.stringify({
        source: 'amazon-jp',
        query: payload.query || '',
        url: payload.url || '',
        capturedAt: payload.capturedAt || null,
        items: payload.items,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      const hint = res.status === 401 ? '（トークンが無効です）' : '';
      throw new Error(`HTTP ${res.status}${hint}: ${text.slice(0, 80)}`);
    }
    const json = await res.json().catch(() => ({}));
    setStatus(
      `送信完了: 受信 ${json.received ?? payload.items.length}件 / 新規 ${json.created ?? '?'}件`,
      'ok',
    );
  } catch (e) {
    setStatus('送信失敗: ' + e.message, 'err');
  }
}

async function copyAsins() {
  const payload = await loadState();
  if (!payload || payload.items.length === 0) {
    setStatus('コピーするASINがありません', 'err');
    return;
  }
  const text = payload.items.map((i) => i.asin).join('\n');
  await navigator.clipboard.writeText(text);
  setStatus(`${payload.items.length} 件のASINをクリップボードにコピー`, 'ok');
}

async function rescan() {
  setStatus('現在のタブを再スキャン中...');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab && tab.url ? tab.url : '';
  const onAmazon =
    url.includes('amazon.co.jp') &&
    (/amazon\.co\.jp\/s[/?]/.test(url) ||
      /\/dp\/|\/gp\/product\/|\/gp\/aw\/d\/|\/product\//.test(url));
  if (!onAmazon) {
    setStatus('Amazon.co.jp の検索結果または商品ページで実行してください', 'err');
    return;
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js'],
  });
  setTimeout(async () => {
    render(await loadState());
    setStatus('再スキャン完了', 'ok');
  }, 600);
}

(async function init() {
  $('endpoint').value = await loadEndpoint();
  $('token').value = await loadToken();
  render(await loadState());
  $('send').addEventListener('click', send);
  $('copy').addEventListener('click', copyAsins);
  $('rescan').addEventListener('click', rescan);
})();
