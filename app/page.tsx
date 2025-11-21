import { headers } from "next/headers";
import { getHostType } from "@/lib/domains";
import ComingSoonPage from "./coming-soon";

export default async function Home() {
  // Obtener el host desde los headers
  const headersList = await headers();
  const host = headersList.get("host") || "";
  
  // Verificar si es bookfast.es o www.bookfast.es (marketing)
  const hostType = getHostType(host);
  
  // Si es marketing (bookfast.es o www.bookfast.es), mostrar página de "en desarrollo"
  if (hostType === "marketing") {
    return <ComingSoonPage />;
  }
  
  // Para otros casos (localhost, etc.), mostrar el mensaje por defecto
  return <h1>Platform OK ✓</h1>;
}
