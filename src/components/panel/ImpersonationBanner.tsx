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
    <div className="bg-[rgba(232,176,74,0.10)] border-b border-[rgba(232,176,74,0.25)] px-4 md:px-6 py-3">
      <div className="flex items-center justify-between gap-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-[var(--bf-warn)]">⚠️</span>
          <span className="text-[#F2C87A]" style={{ fontFamily: "var(--font-sans)" }}>
            Estás viendo la cuenta de{" "}
            <span className="font-semibold">{tenantName}</span> como
            administrador.
          </span>
        </div>
        <button
          onClick={onEndImpersonation}
          className="text-xs font-medium text-[#F2C87A] hover:text-[var(--bf-warn)] hover:bg-[rgba(232,176,74,0.15)] px-3 py-1.5 rounded-[var(--r-md)] transition-all whitespace-nowrap"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Salir de impersonación
        </button>
      </div>
    </div>
  );
}

