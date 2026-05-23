'use client';

import * as React from 'react';
import { Ban, Plus, Wand2 } from 'lucide-react';
import { PageHeader } from '@/components/common/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ngKeywords, type NgKeyword } from '@/lib/mock-data';
import { applyNgWords } from '@/lib/translation/translate';

const scopeLabel: Record<NgKeyword['scope'], string> = {
  title: '商品名',
  description: '説明文',
  all: '全て',
};

export default function NgWordsPage() {
  const [rows, setRows] = React.useState<NgKeyword[]>(ngKeywords);
  const [keyword, setKeyword] = React.useState('');
  const [action, setAction] = React.useState<NgKeyword['action']>('block');
  const [replaceWith, setReplaceWith] = React.useState('');
  const [scope, setScope] = React.useState<NgKeyword['scope']>('all');
  const [sample, setSample] = React.useState(
    '日本製 正規品 最安値 ヘッドホン 完全ワイヤレス 並行輸入',
  );

  const preview = applyNgWords(sample, 'title');

  const add = () => {
    if (!keyword.trim()) return;
    setRows((r) => [
      {
        id: `NG-${String(r.length + 1).padStart(2, '0')}`,
        keyword: keyword.trim(),
        action,
        replaceWith: action === 'replace' ? replaceWith : undefined,
        scope,
        reason: '（手動追加）',
        hits: 0,
      },
      ...r,
    ]);
    setKeyword('');
    setReplaceWith('');
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <PageHeader
        title="禁止ワード辞書"
        description="出品テキストから自動でブロック／置換する語を管理します。出品・CSV生成・翻訳の各処理で自動適用されます。"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            ワードを追加
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
            <Input
              className="md:col-span-3"
              placeholder="禁止ワード"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              className="md:col-span-2"
              value={action}
              onChange={(e) =>
                setAction(e.target.value as NgKeyword['action'])
              }
            >
              <option value="block">ブロック</option>
              <option value="replace">置換</option>
            </Select>
            <Input
              className="md:col-span-3"
              placeholder="置換後の語（置換時のみ）"
              value={replaceWith}
              disabled={action !== 'replace'}
              onChange={(e) => setReplaceWith(e.target.value)}
            />
            <Select
              className="md:col-span-2"
              value={scope}
              onChange={(e) =>
                setScope(e.target.value as NgKeyword['scope'])
              }
            >
              <option value="all">全て</option>
              <option value="title">商品名</option>
              <option value="description">説明文</option>
            </Select>
            <Button className="md:col-span-2" size="sm" onClick={add}>
              <Plus className="h-4 w-4" />
              追加
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-info" />
            適用プレビュー
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={sample}
            onChange={(e) => setSample(e.target.value)}
            className="font-mono text-sm"
          />
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            <div className="text-xs text-muted-foreground mb-1">適用後</div>
            <div className="font-mono">{preview.text || '（空）'}</div>
          </div>
          {preview.applied.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {preview.applied.map((a, i) => (
                <Badge
                  key={i}
                  variant={a.action === 'block' ? 'destructive' : 'warning'}
                >
                  {a.keyword}（{a.action === 'block' ? 'ブロック' : '置換'}）
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              ヒットした禁止ワードはありません。
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Ban className="h-4 w-4 text-destructive" />
            登録済みワード（{rows.length}）
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ワード</TableHead>
                <TableHead>処理</TableHead>
                <TableHead>対象</TableHead>
                <TableHead>理由</TableHead>
                <TableHead className="text-right">ヒット数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.keyword}</TableCell>
                  <TableCell>
                    {r.action === 'block' ? (
                      <Badge variant="destructive">ブロック</Badge>
                    ) : (
                      <Badge variant="warning">
                        置換 → {r.replaceWith ? r.replaceWith : '（削除）'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="muted">{scopeLabel[r.scope]}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {r.reason}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {r.hits.toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
