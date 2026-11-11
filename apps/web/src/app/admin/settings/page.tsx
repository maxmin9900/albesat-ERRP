"use client";

import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-navy">System Settings</h1>
        <p className="mt-1 text-muted">Configure your البساط management system.</p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-navy">Business Information</h2>
            <p className="mt-4 text-sm text-muted">
              No business profile configured yet. Add your company details through the admin API or
              contact your system administrator.
            </p>
            <Button variant="ghost" size="sm" className="mt-4" disabled>
              Edit
            </Button>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-navy">Notification Preferences</h2>
            <p className="mt-4 text-sm text-muted">
              Notification settings will appear here once configured in the backend.
            </p>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-navy">Integrations</h2>
            <p className="mt-4 text-sm text-muted">
              WhatsApp, SMS, and partner portal toggles are managed via environment configuration
              (WHATSAPP_MODE, OTP_SEND_VIA_WHATSAPP, etc.).
            </p>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="font-bold text-navy">Data Management</h2>
            <div className="mt-4 space-y-2">
              <Button variant="outline" className="w-full justify-start" disabled>
                Export All Data
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                Backup Database
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                Clear Cache
              </Button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
