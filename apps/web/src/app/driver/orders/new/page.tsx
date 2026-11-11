"use client";

import { OrderRegistrationWizard } from "@/components/orders/order-registration-wizard";

export default function DriverNewOrderPage() {
  return (
    <OrderRegistrationWizard
      variant="driver"
      heading="New Order"
      cancelHref="/driver"
      doneHref="/driver"
    />
  );
}
