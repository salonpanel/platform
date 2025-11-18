import { format } from "date-fns";

export function toTenantLocalDate(date: Date, timezone: string): Date {
	// Convierte un Date a la hora local del tenant usando el timezone indicado.
	// Mantiene la misma "hora de pared" percibida por el usuario del tenant.
	return new Date(date.toLocaleString("en-US", { timeZone: timezone }));
}

export function toUtcFromTenantLocal(date: Date, timezone: string): Date {
	// Convierte una fecha interpretada en el timezone del tenant a su equivalente en UTC.
	// Útil cuando el usuario selecciona fecha/hora locales y debemos guardar en UTC.
	const local = toTenantLocalDate(date, timezone);
	// Diferencia entre la representación local y la original indica el offset
	const offsetMs = local.getTime() - date.getTime();
	return new Date(date.getTime() - offsetMs);
}

/**
 * Formatea una fecha ISO en el timezone del tenant usando un patrón de date-fns
 */
export function formatInTenantTz(iso: string, timezone: string, pattern: string): string {
	const date = new Date(iso);
	const local = toTenantLocalDate(date, timezone);
	return format(local, pattern);
}





