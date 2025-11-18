"use client";

import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Scissors, 
  User, 
  MessageSquare, 
  Settings, 
  LogOut,
  Search,
  Bell,
  X,
  Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { ScrollArea } from "@/components/ui/ScrollArea";

interface AppShellProps {
  children: ReactNode;
  tenantName?: string;
  userEmail?: string;
  userAvatar?: string;
  userRole?: string | null;
  timezone?: string;
  onSearch?: (query: string) => void;
  onNotificationsClick?: () => void;
  onSettingsClick?: () => void;
  onLogout?: () => void;
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const navItems: NavItem[] = [
  { href: "/panel", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: "/panel/agenda", label: "Agenda", icon: <Calendar className="h-5 w-5" /> },
  { href: "/panel/clientes", label: "Clientes", icon: <Users className="h-5 w-5" /> },
  { href: "/panel/servicios", label: "Servicios", icon: <Scissors className="h-5 w-5" /> },
  { href: "/panel/staff", label: "Staff", icon: <User className="h-5 w-5" /> },
  { href: "/panel/chat", label: "Chats", icon: <MessageSquare className="h-5 w-5" /> },
  { href: "/panel/ajustes", label: "Ajustes", icon: <Settings className="h-5 w-5" /> },
];

export function AppShell({
  children,
  tenantName = "Barbería",
  userEmail,
  userAvatar,
  userRole,
  timezone = "Europe/Madrid",
  onSearch,
  onNotificationsClick,
  onSettingsClick,
  onLogout,
}: AppShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const isActive = (href: string) => {
    if (href === "/panel") {
      return pathname === "/panel" || pathname === "/panel/";
    }
    return pathname === href || pathname?.startsWith(href + "/");
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  const getInitials = (email: string | null) => {
    if (!email) return "?";
    const parts = email.split("@")[0].split(".");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="flex h-screen" style={{ background: "var(--color-bg-base)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 md:hidden transition-opacity animate-fadeIn"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 w-64 glass flex flex-col transition-transform duration-300 ease-in-out shadow-glass",
          "bg-[var(--color-bg-primary)] backdrop-blur-xl border-r border-[var(--glass-border)]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo/Name */}
        <div className="flex h-16 items-center justify-between border-b border-[var(--glass-border)] px-6 glass-subtle">
          <h1 className="text-lg font-semibold text-[var(--color-text-primary)] truncate font-satoshi">
            {tenantName}
          </h1>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1 rounded-lg transition-colors"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1" orientation="vertical">
          <nav className="p-4">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-3 text-sm font-medium font-satoshi transition-smooth",
                        "relative group",
                        active
                          ? "gradient-primary text-white shadow-neon-glow-blue"
                          : "text-[var(--color-text-secondary)] hover:glass-subtle hover:text-white"
                      )}
                      style={{
                        borderRadius: "var(--radius-md)",
                      }}
                    >
                      <span className={cn(
                        "flex-shrink-0 transition-smooth",
                        active ? "text-white" : "text-[var(--color-text-secondary)] group-hover:text-white"
                      )}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                      {active && (
                        <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white/80 shadow-glow-blue" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </ScrollArea>

        {/* Footer - Logout */}
        <div className="border-t border-[var(--glass-border)] p-4 glass-subtle">
          <button
            onClick={() => {
              setSidebarOpen(false);
              onLogout?.();
            }}
            className={cn(
              "w-full flex items-center gap-3 rounded-[var(--radius-md)] px-4 py-2.5 text-sm",
              "text-[var(--color-text-secondary)] hover:glass-subtle hover:text-white transition-smooth font-satoshi"
            )}
            style={{
              borderRadius: "var(--radius-md)",
            }}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="h-16 border-b border-[var(--glass-border)] glass flex items-center justify-between px-4 md:px-6 shadow-glass bg-[var(--color-bg-primary)] backdrop-blur-xl sticky top-0 z-30">
          <div className="flex items-center gap-4 flex-1">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-2 -ml-2 rounded-lg transition-colors"
              aria-label="Abrir menú"
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Breadcrumb title */}
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] font-satoshi">
                {pathname === "/panel" || pathname === "/panel/"
                  ? "Dashboard"
                  : pathname === "/panel/agenda"
                  ? "Agenda"
                  : pathname === "/panel/clientes"
                  ? "Clientes"
                  : pathname === "/panel/servicios"
                  ? "Servicios"
                  : pathname === "/panel/staff"
                  ? "Staff"
                  : pathname === "/panel/chat"
                  ? "Chats"
                  : pathname === "/panel/ajustes"
                  ? "Ajustes"
                  : "Panel"}
              </h2>
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] mt-0.5">
                <span className="font-medium">{tenantName}</span>
                {userRole && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{userRole}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative hidden md:block">
              {searchOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="w-64 px-4 py-2 text-sm rounded-[var(--radius-md)] glass border-[var(--glass-border)] bg-[rgba(255,255,255,0.03)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-[var(--gradient-primary-start)]/30 transition-smooth"
                    autoFocus
                    onBlur={() => !searchQuery && setSearchOpen(false)}
                  />
                  <button
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1 rounded transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:glass-subtle rounded-lg transition-smooth"
                  aria-label="Buscar"
                >
                  <Search className="h-5 w-5" />
                </button>
              )}
            </div>

            {/* Timezone indicator (desktop) */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-[var(--color-text-secondary)] px-3 py-1.5 rounded-lg glass-subtle">
              <span className="font-medium">TZ:</span>
              <span className="font-mono">{timezone}</span>
            </div>

            {/* Notifications */}
            <button
              onClick={onNotificationsClick}
              className="relative p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:glass-subtle rounded-lg transition-smooth"
              aria-label="Notificaciones"
            >
              <Bell className="h-5 w-5" />
              {/* Notification badge */}
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border-2 border-[var(--color-bg-primary)]" />
            </button>

            {/* Settings */}
            <button
              onClick={onSettingsClick}
              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:glass-subtle rounded-lg transition-smooth"
              aria-label="Configuración"
            >
              <Settings className="h-5 w-5" />
            </button>

            {/* User Avatar */}
            <div className="flex items-center gap-2 pl-2 border-l border-[var(--glass-border)]">
              <Avatar
                src={userAvatar || undefined}
                name={userEmail || undefined}
                size="sm"
                className="cursor-pointer hover:ring-2 hover:ring-[var(--gradient-primary-start)]/30 transition-smooth"
              />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto scrollbar-hide relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-bg-base)] via-[var(--color-bg-primary)]/30 to-[var(--color-bg-base)] pointer-events-none" />
          <div className="relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}






