import type { Service } from "@/types/services";

export function getServiceTotalDuration(
  service: Pick<Service, "duration_min" | "buffer_min">
): number {
  return service.duration_min + (service.buffer_min ?? 0);
}



