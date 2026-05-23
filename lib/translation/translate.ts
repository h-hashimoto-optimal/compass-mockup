// 日→韓 翻訳ラッパ。DEEPL_API_KEY が env にあればDeepL、無ければ簡易マップ＋カナ→ハングル擬似変換。
//
// 翻訳後に禁止ワード辞書（ngKeywords）を適用する（busoken準拠：禁止ワード機能）。

import { ngKeywords } from '../mock-data';

const HAS_DEEPL = Boolean(process.env.DEEPL_API_KEY);

export type NgApplied = { keyword: string; action: 'block' | 'replace' };

export type TranslationResult = {
  source: 'deepl' | 'mock';
  ja: string;
  ko: string;
  ngApplied: NgApplied[];
};

/**
 * 禁止ワード辞書を適用する。
 * - block:   当該語を除去（実環境では出品キューから除外＋アラート）
 * - replace: replaceWith に置換
 * 戻り値の applied で「どの語にヒットしたか」を呼び出し側に伝える。
 */
export function applyNgWords(
  text: string,
  scope: 'title' | 'description',
): { text: string; applied: NgApplied[] } {
  let out = text;
  const applied: NgApplied[] = [];
  for (const ng of ngKeywords) {
    if (ng.scope !== 'all' && ng.scope !== scope) continue;
    if (!out.includes(ng.keyword)) continue;
    out = out.split(ng.keyword).join(ng.action === 'replace' ? ng.replaceWith ?? '' : '');
    applied.push({ keyword: ng.keyword, action: ng.action });
  }
  out = out.replace(/\s{2,}/g, ' ').trim();
  return { text: out, applied };
}

export async function translateJaToKo(ja: string): Promise<TranslationResult> {
  const rawKo = HAS_DEEPL ? await callDeepl(ja) : mockTranslate(ja);
  const { text: ko, applied } = applyNgWords(rawKo, 'title');
  return {
    source: HAS_DEEPL ? 'deepl' : 'mock',
    ja,
    ko,
    ngApplied: applied,
  };
}

async function callDeepl(text: string): Promise<string> {
  const url = process.env.DEEPL_API_KEY?.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      text,
      source_lang: 'JA',
      target_lang: 'KO',
    }),
  });
  if (!res.ok) {
    throw new Error(`DeepL ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { translations: { text: string }[] };
  return json.translations[0]?.text ?? text;
}

// 既知ブランド/単語の対訳辞書。ヒットすれば置換。それ以外はそのまま残す（モックなので品質は本番DeepL相当ではない）。
const dict: Record<string, string> = {
  ナイキ: '나이키',
  エアマックス: '에어맥스',
  ホワイト: '화이트',
  ブラック: '블랙',
  Sony: '소니',
  ワイヤレスヘッドホン: '무선 헤드폰',
  ヘッドホン: '헤드폰',
  Anker: '앤커',
  モバイルバッテリー: '보조배터리',
  PowerCore: '파워코어',
  シャープ: '샤프',
  ホットクック: '핫쿡',
  ヘルシオ: '헬시오',
  Pokemon: '포켓몬',
  ぬいぐるみ: '인형',
  ピカチュウ: '피카츄',
  ユニクロ: '유니클로',
  ヒートテック: '히트텍',
  クルーネック: '크루넥',
  無印良品: '무인양품',
  アロマディフューザー: '아로마 디퓨저',
  カルディ: '칼디',
  オリジナル: '오리지널',
  コーヒー豆: '커피원두',
  マイルド: '마일드',
  約: '약',
  大: '대형',
};

function mockTranslate(ja: string): string {
  let s = ja;
  for (const [k, v] of Object.entries(dict)) {
    s = s.split(k).join(v);
  }
  return s;
}
