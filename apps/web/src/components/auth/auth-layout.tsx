import { Logo } from "@/components/ui/logo";
import { StepIndicator } from "@/components/auth/step-indicator";

interface AuthLayoutProps {
  children: React.ReactNode;
  step?: number;
  totalSteps?: number;
}

export function AuthLayout({ children, step = 1, totalSteps = 4 }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-100 to-slate-50 px-4 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo size="lg" showSubtitle />
        <span className="mt-3 rounded-md bg-blue-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Admin Portal
        </span>
        <StepIndicator current={step} total={totalSteps} className="mt-6" />
      </div>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-10 text-center text-xs text-muted">
        Albesat Carpet Pro v2.4 · Persian Carpet Management System
      </p>
    </div>
  );
}


