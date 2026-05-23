import { Badge } from '@/components/ui/badge';
import {
  type ListingStatus,
  statusColor,
  statusLabel,
} from '@/lib/mock-data';

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return <Badge variant={statusColor[status]}>{statusLabel[status]}</Badge>;
}
