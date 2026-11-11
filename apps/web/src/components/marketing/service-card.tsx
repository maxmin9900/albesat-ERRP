import { Button } from "@/components/ui/button";
import Link from "next/link";

interface ServiceCardProps {
  title: string;
  subtitle: string;
  description: string;
  price: string;
  borderColor: string;
  icon: string;
}

export function ServiceCard({ title, subtitle, description, price, borderColor, icon }: ServiceCardProps) {
  return (
    <article
      className={`flex flex-col rounded-3xl border border-border bg-white p-8 shadow-lg shadow-slate-200/40 border-t-4 ${borderColor}`}
    >
      <span className="text-3xl" aria-hidden>
        {icon}
      </span>
      <h3 className="mt-4 text-xl font-bold text-navy">{title}</h3>
      <p className="text-sm text-muted">{subtitle}</p>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-muted">{description}</p>
      <div className="mt-8 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted">Starting from</p>
          <p className="text-lg font-bold text-navy">{price}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Learn More
          </Button>
          <Link href="#book">
            <Button variant="navy" size="sm">
              Book
            </Button>
          </Link>
        </div>
      </div>
    </article>
  );
}
