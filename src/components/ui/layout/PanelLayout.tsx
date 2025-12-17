"use client";

import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { SecondaryColumn } from "./SecondaryColumn";
import { MainContent } from "./MainContent";

interface PanelLayoutProps {
  children: ReactNode;
  tenantName: string;
  sidebarOpen?: boolean;
  onSidebarToggle?: () => void;
  secondaryColumn?: ReactNode;
  secondaryColumnTitle?: string;
  secondaryColumnOpen?: boolean;
  onSecondaryColumnToggle?: () => void;
}

export function PanelLayout({
  children,
  tenantName,
  sidebarOpen = true,
  onSidebarToggle,
  secondaryColumn,
  secondaryColumnTitle,
  secondaryColumnOpen = false,
  onSecondaryColumnToggle,
}: PanelLayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        tenantName={tenantName}
        isOpen={sidebarOpen}
        onClose={onSidebarToggle}
      />

      {/* Main Content */}
      <MainContent>{children}</MainContent>

      {/* Secondary Column (opcional) */}
      {secondaryColumn && (
        <SecondaryColumn
          isOpen={secondaryColumnOpen}
          onClose={onSecondaryColumnToggle}
          title={secondaryColumnTitle}
        >
          {secondaryColumn}
        </SecondaryColumn>
      )}
    </div>
  );
}








