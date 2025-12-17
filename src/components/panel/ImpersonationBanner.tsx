"use client";

interface ImpersonationBannerProps {
  tenantName: string;
  onEndImpersonation: () => void;
}

export function ImpersonationBanner({
  tenantName,
  onEndImpersonation,
}: ImpersonationBannerProps) {
  return (
    <div className="glass bg-amber-500/10 border-b border-amber-500/20 px-4 md:px-6 py-3 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-amber-400">⚠️</span>
          <span className="text-amber-300 font-satoshi">
            Estás viendo la cuenta de{" "}
            <span className="font-semibold">{tenantName}</span> como
            administrador.
          </span>
        </div>
        <button
          onClick={onEndImpersonation}
          className="text-xs font-medium text-amber-300 hover:text-amber-200 hover:glass-subtle px-3 py-1.5 rounded-[var(--radius-md)] transition-smooth whitespace-nowrap font-satoshi"
        >
          Salir de impersonación
        </button>
      </div>
    </div>
  );
}

