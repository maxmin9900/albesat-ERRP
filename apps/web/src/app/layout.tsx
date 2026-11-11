import type { Metadata } from "next";

import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Albesat Carpet Pro",
  description: "Persian carpet cleaning management platform",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
