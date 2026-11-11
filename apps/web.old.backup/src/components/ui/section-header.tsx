interface SectionHeaderProps {
  overline: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}

export function SectionHeader({ overline, title, description, align = "center" }: SectionHeaderProps) {
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <header className={`max-w-3xl ${alignClass}`}>
      <p className="text-sm font-bold uppercase tracking-widest text-primary">{overline}</p>
      <h2 className="mt-2 text-3xl font-extrabold text-navy sm:text-4xl">{title}</h2>
      {description && <p className="mt-4 text-muted">{description}</p>}
    </header>
  );
}
