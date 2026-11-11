"use client";

import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

const NAV = [
  { href: "#services", label: "Services" },
  { href: "#benefits", label: "Benefits" },
  { href: "#faq", label: "Reviews" },
  { href: "#contact", label: "Contact" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 lg:px-8">
        <Logo href="/" />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-navy/80 hover:text-primary">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <Link href="#book">
            <Button>Book Now →</Button>
          </Link>
        </div>
        <button
          type="button"
          className="rounded-lg p-2 text-navy md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open && (
        <nav className="border-t border-border px-4 py-4 md:hidden" aria-label="Mobile">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block py-2 text-sm font-medium text-navy"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link href="#book" className="mt-2 block" onClick={() => setOpen(false)}>
            <Button className="w-full">Book Now →</Button>
          </Link>
        </nav>
      )}
    </header>
  );
}

