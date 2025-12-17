"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Calendar,
  ShoppingCart,
  Users,
  Scissors,
  Package,
  Megaphone,
  BarChart3,
  UserCircle,
  Settings,
  HelpCircle,
} from "lucide-react";

interface SidebarItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const sidebarItems: SidebarItem[] = [
  { href: "/panel/agenda", label: "Agenda", icon: Calendar },
  { href: "/panel/ventas", label: "Ventas", icon: ShoppingCart },
  { href: "/panel/clientes", label: "Clientes", icon: Users },
  { href: "/panel/servicios", label: "Servicios", icon: Scissors },
  { href: "/panel/productos", label: "Productos", icon: Package },
  { href: "/panel/marketing", label: "Marketing", icon: Megaphone },
  { href: "/panel/estadisticas", label: "Estadísticas", icon: BarChart3 },
  { href: "/panel/staff", label: "Staff", icon: UserCircle },
  { href: "/panel/ajustes", label: "Ajustes", icon: Settings },
  { href: "/panel/ayuda", label: "Ayuda", icon: HelpCircle },
];

interface SidebarProps {
  tenantName: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ tenantName, isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/panel/agenda") {
      return pathname === href || pathname?.startsWith(href + "/");
    }
    return pathname === href || pathname?.startsWith(href + "/");
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-[#111827] border-r border-[#1f2937] flex flex-col transition-transform duration-300 ease-in-out h-screen",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Logo/Name */}
        <div className="flex h-16 items-center border-b border-[#1f2937] px-6">
          <h1 className="text-lg font-semibold text-white truncate">
            {tenantName}
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (onClose) onClose();
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      active
                        ? "bg-[var(--color-accent)]/20 text-[var(--color-accent)] border-l-4 border-[var(--color-accent)]"
                        : "text-gray-400 hover:bg-[#1f2937] hover:text-gray-200"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Footer */}
        <div className="border-t border-[#1f2937] p-4">
          <Link
            href="/logout"
            className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-gray-400 hover:bg-[#1f2937] hover:text-gray-200 transition-all duration-200"
            onClick={() => {
              if (onClose) onClose();
            }}
          >
            <span>🚪</span>
            <span>Cerrar sesión</span>
          </Link>
        </div>
      </aside>
    </>
  );
}








