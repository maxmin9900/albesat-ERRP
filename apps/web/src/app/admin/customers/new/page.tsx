"use client";

import { AddressMapField } from "@/components/maps/address-map-field";
import type { MapLocation } from "@/components/maps/oman-map-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomerPhoneInput } from "@/components/ui/customer-phone-input";
import { useCreateCustomer } from "@/lib/api/customers-hooks";
import { isValidCustomerPhone, CUSTOMER_PHONE_ERROR, parseCustomerPhone } from "@/lib/phone";
import { Check, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

// Edit doc — Add Customer (Rule 1: New Customer ≠ New Order). Registers a
// customer profile only; no order is created.
export default function NewCustomerPage() {
  const router = useRouter();
  const createCustomer = useCreateCustomer();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<MapLocation | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (name.trim().length < 2) {
      setError("Customer name is required");
      return;
    }
    if (!isValidCustomerPhone(phone)) {
      setError(CUSTOMER_PHONE_ERROR);
      return;
    }
    try {
      const profile = await createCustomer.mutateAsync({
        name: name.trim(),
        phone: parseCustomerPhone(phone.trim())!,
        address: address.trim() || undefined,
        latitude: location?.lat ?? undefined,
        longitude: location?.lng ?? undefined,
        notes: notes.trim() || undefined,
      });
      setCreated(profile.phone);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create customer");
    }
  };

  if (created) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-navy">Customer Created</h1>
        <p className="mt-2 text-muted">
          <strong>{name.trim()}</strong> was added to the customer database. No order was
          created — you can register one later from New Order.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => router.push("/admin/customers")}>Back to Customers</Button>
          <Button variant="secondary" onClick={() => router.push("/admin/orders/new")}>
            Create Order for Customer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-sm text-muted">
        <Link href="/admin" className="hover:text-primary">
          Admin Panel
        </Link>
        {" / "}
        <Link href="/admin/customers" className="hover:text-primary">
          Customers
        </Link>
        {" / "}
        <span className="text-navy">Add Customer</span>
      </p>
      <div className="mt-2 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <UserPlus className="h-5 w-5 text-primary" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-navy">Add Customer</h1>
          <p className="text-sm text-muted">
            Register a customer without creating an order.
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-5 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <CustomerPhoneInput
            label="Phone Number *"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <AddressMapField
          label="Address & Location"
          value={address}
          onChange={setAddress}
          location={location}
          onLocationChange={setLocation}
          linkPaste
        />
        <div>
          <label className="mb-2 block text-sm font-semibold text-navy">Notes (Optional)</label>
          <textarea
            className="min-h-[80px] w-full rounded-xl border border-border bg-surface-alt px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="flex gap-3 border-t border-border pt-5">
          <Button onClick={submit} loading={createCustomer.isPending}>
            <Check className="h-4 w-4" /> Create Customer
          </Button>
          <Button variant="outline" onClick={() => router.push("/admin/customers")}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
