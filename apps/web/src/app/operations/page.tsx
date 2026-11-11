"use client";

import { LoadForDeliveryPanel } from "@/components/operations/LoadForDeliveryPanel";
import { OperationsQueueView } from "@/components/operations/OperationsQueue";
import { ReceiveScanPanel } from "@/components/operations/ReceiveScanPanel";
import { StartOperationPanel } from "@/components/operations/StartOperationPanel";
import { Button } from "@/components/ui/button";
import { useOperationsQueue } from "@/lib/api/operations-hooks";
import { RefreshCw } from "lucide-react";

export default function OperationsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useOperationsQueue();

  const refresh = () => void refetch();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Wash Operations</h1>
          <p className="mt-1 text-sm text-muted">
            Three steps: Received By Operation → In Operation → Ready For Delivery
          </p>
        </div>
        <Button type="button" variant="secondary" loading={isFetching} onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh queue
        </Button>
      </div>

      <ReceiveScanPanel onReceived={refresh} />
      <StartOperationPanel onStarted={refresh} />
      <LoadForDeliveryPanel onLoaded={refresh} />

      {isLoading && (
        <p className="text-center text-sm text-muted">Loading operations queue...</p>
      )}

      {isError && (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {error instanceof Error ? error.message : "Failed to load queue"}
        </p>
      )}

      {data && <OperationsQueueView queue={data} onUpdated={refresh} />}
    </div>
  );
}
