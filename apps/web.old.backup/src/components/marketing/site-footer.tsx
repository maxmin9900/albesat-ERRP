import { Logo } from "@/components/ui/logo";
import Link from "next/link";
import { Share2 } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 lg:grid-cols-3 lg:px-8">
        <div>
          <Logo href="/" variant="footer" showSubtitle />
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            New York&apos;s trusted specialist in Persian and handwoven carpet cleaning since 2009. Free pickup and delivery city-wide.
          </p>
          <div className="mt-6 flex gap-3">
            {[1, 2, 3].map((i) => (
              <a
                key={i}
                href="#"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-300 hover:bg-primary hover:text-white"
                aria-label="Social link"
              >
                <Share2 className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
        <div>
          <h4 className="font-bold">Services</h4>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            {["Standard Wash", "Premium Wash", "Antique Carpet", "Book a Pickup"].map((l) => (
              <li key={l}>
                <Link href="#services" className="hover:text-primary">
                  {l}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-bold">Contact</h4>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            <li>+1 (212) 555-0147</li>
            <li>WhatsApp Us</li>
            <li>hello@firoozehcarpets.com</li>
            <li>48 Carpet Row, Manhattan, NY 10001</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-800 py-6 text-center text-xs text-slate-500">
        © 2024 Firoozeh Carpet Cleaning — All rights reserved.
      </div>
    </footer>
  );
}
