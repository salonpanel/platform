import { redirect } from "next/navigation";

/**
 * La entrada del panel (`/panel`) lleva a la agenda: es el núcleo del producto.
 * El dashboard sigue disponible en `/panel/dashboard`.
 */
export default async function PanelHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  const q = new URLSearchParams();
  if (resolvedSearchParams) {
    for (const [key, raw] of Object.entries(resolvedSearchParams)) {
      if (raw === undefined) continue;
      const vals = Array.isArray(raw) ? raw : [raw];
      for (const v of vals) q.append(key, v);
    }
  }
  const suffix = q.toString() ? `?${q.toString()}` : "";
  redirect(`/panel/agenda${suffix}`);
}
