"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, LucideIcon } from "lucide-react";
import { useState } from "react";

interface BenefitItem {
  id: string;
  icon: LucideIcon;
  iconBg: string;
  title: string;
  short: string;
  detail: string;
}

export function BenefitAccordion({ items }: { items: BenefitItem[] }) {
  const [openId, setOpenId] = useState(items[0]?.id ?? "");

  return (
    <>
      {items.map((item) => {
        const isOpen = openId === item.id;
        const Icon = item.icon;
        return (
          <div
            key={item.id}
            className="rounded-2xl bg-surface-alt p-6 shadow-sm"
          >
            <button
              type="button"
              className="flex w-full items-start gap-4 text-left"
              onClick={() => setOpenId(isOpen ? "" : item.id)}
              aria-expanded={isOpen}
            >
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", item.iconBg)}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-navy">{item.title}</p>
                <p className="mt-1 text-sm text-muted">{item.short}</p>
              </div>
              {isOpen ? (
                <ChevronUp className="h-5 w-5 shrink-0 text-muted" />
              ) : (
                <ChevronDown className="h-5 w-5 shrink-0 text-muted" />
              )}
            </button>
            {isOpen && (
              <>
                <hr className="my-4 border-border" />
                <p className="text-sm leading-relaxed text-muted">{item.detail}</p>
              </>
            )}
          </div>
        );
      })}
    </>
  );
}