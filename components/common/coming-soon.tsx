import { Construction } from 'lucide-react';
import { PageHeader } from './page-header';
import { Card, CardContent } from '@/components/ui/card';

export function ComingSoon({
  title,
  description,
  notes,
}: {
  title: string;
  description?: string;
  notes?: string[];
}) {
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="p-10 grid place-items-center text-center gap-3">
          <Construction className="h-10 w-10 text-warning" />
          <p className="text-sm text-muted-foreground">
            この画面はモックアップ準備中です
          </p>
          {notes && notes.length > 0 && (
            <ul className="text-xs text-muted-foreground space-y-1 pt-3 border-t w-full max-w-md mx-auto text-left">
              {notes.map((n, i) => (
                <li key={i}>・ {n}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
