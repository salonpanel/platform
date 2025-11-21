import type { Metadata } from "next";

/**
 * Layout para el área de administración
 * 
 * Metadatos configurados para NO indexar (área privada)
 */
export const metadata: Metadata = {
  title: "Administración - BookFast",
  description: "Consola de administración de la plataforma BookFast",
  robots: {
    index: false, // NO indexar área de administración
    follow: false,
    noarchive: true,
    nosnippet: true,
  },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}




