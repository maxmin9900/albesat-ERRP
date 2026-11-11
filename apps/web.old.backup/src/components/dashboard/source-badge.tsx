import { cn } from "@/lib/utils";

const SOURCE_STYLES: Record<string, string> = {
  website: "bg-blue-100 text-blue-800",
  whatsapp: "bg-green-100 text-green-800",
  phone: "bg-yellow-100 text-yellow-800",
  partner: "bg-purple-100 text-purple-800",
};

export function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
        SOURCE_STYLES[source] ?? "bg-slate-100 text-slate-600",
      )}
    >
      {source}
    </span>
  );
}
