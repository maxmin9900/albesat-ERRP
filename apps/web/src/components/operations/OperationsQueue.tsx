"use client";

import type { OperationCarpetItem, OperationsQueue } from "@/lib/api/operations-hooks";
import { formatDate } from "@/lib/utils";
import { OperationCarpetActions } from "@/components/operations/OperationCarpetActions";

function formatReceivedAt(value: string | null): string {
  if (!value) return "—";
  return formatDate(value);
}

function CarpetRow({
  item,
  onUpdated,
  showActions = true,
}: {
  item: OperationCarpetItem;
  onUpdated: () => void;
  showActions?: boolean;
}) {
  return (
    <tr className="border-b border-border/60 hover:bg-surface-alt/80">
      <td className="px-3 py-3 font-mono text-xs font-semibold text-navy" dir="ltr">
        {item.tracking_code}
      </td>
      <td className="px-3 py-3 font-mono text-xs text-muted" dir="ltr">
        {item.qr_code && item.qr_code !== item.tracking_code ? item.qr_code : "—"}
      </td>
      <td className="px-3 py-3">
        <p className="font-semibold text-navy">{item.customer_name}</p>
        {item.customer_phone && (
          <p className="text-xs text-muted" dir="ltr">
            {item.customer_phone}
          </p>
        )}
      </td>
      <td className="px-3 py-3 text-sm text-navy">{item.carpet_type || "—"}</td>
      <td className="px-3 py-3">
        <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {item.status_label}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-muted">{formatReceivedAt(item.received_at)}</td>
      {showActions && (
        <td className="px-3 py-3">
          <OperationCarpetActions item={item} onUpdated={onUpdated} />
        </td>
      )}
    </tr>
  );
}

function SectionTable({
  title,
  count,
  items,
  empty,
  onUpdated,
  showActions = true,
}: {
  title: string;
  count: number;
  items: OperationCarpetItem[];
  empty: string;
  onUpdated: () => void;
  showActions?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="font-bold text-navy">{title}</h2>
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
          {count}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-alt text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Tracking</th>
                <th className="px-3 py-2">QR tag</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Carpet type</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Received at</th>
                {showActions && <th className="px-3 py-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <CarpetRow
                  key={item.id}
                  item={item}
                  onUpdated={onUpdated}
                  showActions={showActions}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function OperationsQueueView({
  queue,
  onUpdated,
}: {
  queue: OperationsQueue;
  onUpdated: () => void;
}) {
  const inOperation = queue.in_operation;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-navy">Operations queue</h2>
        <p className="text-sm text-muted">
          Received By Operation → In Operation → Ready For Delivery
        </p>
      </div>
      <SectionTable
        title="Received By Operation"
        count={queue.received.length}
        items={queue.received}
        empty="No carpets waiting to start."
        onUpdated={onUpdated}
      />
      <SectionTable
        title="In Operation"
        count={inOperation.length}
        items={inOperation}
        empty="No carpets in operation."
        onUpdated={onUpdated}
      />
      <SectionTable
        title="Ready For Delivery"
        count={queue.ready.length}
        items={queue.ready}
        empty="No carpets ready yet."
        onUpdated={onUpdated}
        showActions={false}
      />
    </div>
  );
}
