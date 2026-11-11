import { cn } from "@/lib/utils";

interface AuthCardProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function AuthCard({ title, description, children, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-white p-8 shadow-xl shadow-slate-200/50",
        className,
      )}
    >
      <h1 className="text-2xl font-bold text-navy">{title}</h1>
      {description && <p className="mt-2 text-sm text-muted">{description}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

