"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

const FIELDS = [
  { label: "Business Name", value: "Firouzeh Carpet Wash" },
  { label: "Phone Number", value: "+98 21 4444 5555" },
  { label: "Address", value: "Tehran, Valiasr St., No. 100" },
  { label: "Email", value: "admin@firouzeh.ir" },
];

const NOTIFICATIONS = [
  { label: "Order Alerts via SMS", value: "Enabled" },
  { label: "Daily Report Email", value: "Every day at 18:00" },
  { label: "Delivery Reminders", value: "Enabled" },
];

const TOGGLES = [
  { id: "online", label: "Online Orders", on: true },
  { id: "whatsapp", label: "WhatsApp Bot", on: true },
  { id: "sms", label: "Auto SMS Alerts", on: false },
  { id: "partner", label: "Partner Portal", on: true },
];

export default function SettingsPage() {
  const [toggles, setToggles] = useState(TOGGLES);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-navy">System Settings</h1>
        <p className="mt-1 text-muted">Configure your Firouzeh Carpet Wash management system.</p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-navy">Business Information</h2>
            <div className="mt-4 space-y-4">
              {FIELDS.map((f) => (
                <div
                  key={f.label}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4 last:border-0"
                >
                  <div>
                    <p className="text-sm text-muted">{f.label}</p>
                    <p className="font-medium text-navy">{f.value}</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-navy">Notification Preferences</h2>
            <div className="mt-4 space-y-4">
              {NOTIFICATIONS.map((n) => (
                <div
                  key={n.label}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-4 last:border-0"
                >
                  <div>
                    <p className="text-sm text-muted">{n.label}</p>
                    <p className="font-medium text-navy">{n.value}</p>
                  </div>
                  <Button variant="ghost" size="sm">
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-navy">Quick Toggles</h2>
            <ul className="mt-4 space-y-4">
              {toggles.map((t) => (
                <li key={t.id} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-navy">{t.label}</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={t.on}
                    onClick={() =>
                      setToggles((prev) =>
                        prev.map((x) => (x.id === t.id ? { ...x, on: !x.on } : x)),
                      )
                    }
                    className={cn(
                      "relative h-7 w-12 rounded-full transition-colors",
                      t.on ? "bg-primary" : "bg-slate-200",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform",
                        t.on ? "left-5" : "left-0.5",
                      )}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-navy">Data Management</h2>
            <div className="mt-4 space-y-2">
              <Button variant="outline" className="w-full justify-start">
                Export All Data
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Backup Database
              </Button>
              <Button variant="outline" className="w-full justify-start">
                Clear Cache
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
