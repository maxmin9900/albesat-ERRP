"use client";

import { StatCard } from "@/components/dashboard/stat-card";
import { OrdersTable } from "@/components/dashboard/orders-table";
import { OrderVolumeChart } from "@/components/dashboard/order-volume-chart";
import { OrderSourcesChart } from "@/components/dashboard/order-sources-chart";
import { DailyReportModal } from "@/components/dashboard/modals/daily-report-modal";
import { OrderDetailModal } from "@/components/dashboard/modals/order-detail-modal";
import { RegisterOrderModal } from "@/components/dashboard/modals/register-order-modal";
import { useOrderActions } from "@/lib/hooks/use-order-actions";
import { ScanQrModal } from "@/components/dashboard/modals/scan-qr-modal";
import { Button } from "@/components/ui/button";
import {
  useDashboardStats,
  useOrderVolume,
  useOrderSources,
  useOrders,
} from "@/lib/api/hooks";
import {
  Package,
  CreditCard,
  Droplets,
  Truck,
  FileText,
  Plus,
  QrCode,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export function AdminDashboard() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [volumeRange, setVolumeRange] = useState("7d");
  const [dailyReportOpen, setDailyReportOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const orderActions = useOrderActions();

  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: volume, isLoading: volumeLoading } = useOrderVolume(volumeRange);
  const { data: sources, isLoading: sourcesLoading } = useOrderSources();
  const { data: ordersData, isLoading: ordersLoading } = useOrders({
    status: statusFilter,
    search: search || undefined,
    page: 1,
  });

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Welcome back, Admin 👋</h1>
          <p className="mt-1 text-muted">Today is {today}. Let&apos;s take a look at today&apos;s stats.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setDailyReportOpen(true)}>
            <FileText className="h-4 w-4" /> Daily Report
          </Button>
          <Link href="/admin/orders/new">
            <Button>
              <Plus className="h-4 w-4" /> New Order
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Today's Orders"
          value={statsLoading ? "—" : stats?.todays_orders.value ?? "0"}
          trend={stats?.todays_orders.trend ?? undefined}
          trendUp={stats?.todays_orders.trend_up ?? true}
          subtext={stats?.todays_orders.subtext ?? ""}
          icon={Package}
        />
        <StatCard
          title="Monthly Revenue"
          value={statsLoading ? "—" : stats?.monthly_revenue.value ?? "$0"}
          trend={stats?.monthly_revenue.trend ?? undefined}
          trendUp={stats?.monthly_revenue.trend_up ?? true}
          subtext={stats?.monthly_revenue.subtext ?? ""}
          icon={CreditCard}
        />
        <StatCard
          title="In Washing"
          value={statsLoading ? "—" : stats?.in_washing.value ?? "0"}
          subtext={stats?.in_washing.subtext ?? ""}
          icon={Droplets}
        />
        <StatCard
          title="Ready for Delivery"
          value={statsLoading ? "—" : stats?.ready_for_delivery.value ?? "0"}
          trend={stats?.ready_for_delivery.trend ?? undefined}
          trendUp={stats?.ready_for_delivery.trend_up ?? false}
          subtext={stats?.ready_for_delivery.subtext ?? ""}
          icon={Truck}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrderVolumeChart
            data={volume?.data ?? []}
            onRangeChange={setVolumeRange}
            isLoading={volumeLoading}
          />
        </div>
        <OrderSourcesChart
          sources={sources?.sources ?? []}
          total={sources?.total ?? 0}
          isLoading={sourcesLoading}
        />
      </div>

      <div className="mt-8">
        <OrdersTable
          orders={ordersData?.items ?? []}
          isLoading={ordersLoading}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          search={search}
          onSearch={setSearch}
          compact
          onView={orderActions.handleView}
          onEdit={orderActions.handleEdit}
          onDelete={orderActions.handleDelete}
        />
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/orders/new"
          className="flex items-start gap-4 rounded-2xl bg-white p-6 text-left shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Plus className="h-6 w-6 text-primary" />
          </span>
          <div>
            <p className="font-bold text-navy">Register New Order</p>
            <p className="mt-1 text-sm text-muted">Manually add a customer invoice</p>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          className="flex items-start gap-4 rounded-2xl bg-white p-6 text-left shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100">
            <QrCode className="h-6 w-6 text-yellow-600" />
          </span>
          <div>
            <p className="font-bold text-navy">Scan QR</p>
            <p className="mt-1 text-sm text-muted">Quickly identify carpet in warehouse</p>
          </div>
        </button>
        <Link
          href="/admin/reports"
          className="flex items-start gap-4 rounded-2xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100">
            <BarChart3 className="h-6 w-6 text-blue-600" />
          </span>
          <div>
            <p className="font-bold text-navy">Operations Analytics</p>
            <p className="mt-1 text-sm text-muted">Review wash team performance</p>
          </div>
        </Link>
      </div>

      <DailyReportModal open={dailyReportOpen} onClose={() => setDailyReportOpen(false)} />
      <RegisterOrderModal open={registerOpen} onClose={() => setRegisterOpen(false)} />
      <ScanQrModal open={scanOpen} onClose={() => setScanOpen(false)} />
      <OrderDetailModal
        order={orderActions.viewOrder}
        open={orderActions.detailOpen}
        onClose={() => orderActions.setDetailOpen(false)}
        onEdit={orderActions.handleEdit}
      />
      <RegisterOrderModal
        order={orderActions.editOrder}
        open={orderActions.editOpen}
        onClose={() => orderActions.setEditOpen(false)}
      />
    </div>
  );
}
