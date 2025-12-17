-- 4. Validar funciones públicas clave

-- 4.1 release_expired_holds
SELECT public.release_expired_holds() as released_holds;

-- 4.2 cleanup_expired_holds
SELECT public.cleanup_expired_holds() as cleaned_holds;

-- 4.3 calculate_org_metrics_daily (verificar que no genere error)
SELECT public.calculate_org_metrics_daily('11111111-1111-1111-1111-111111111111', CURRENT_DATE) as metrics_calculated;
