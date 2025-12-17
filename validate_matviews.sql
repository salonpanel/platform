-- 5. Validar materialized views con datos

REFRESH MATERIALIZED VIEW public.vw_booking_overview_mat;
SELECT COUNT(*) as booking_overview_count FROM public.vw_booking_overview_mat;

REFRESH MATERIALIZED VIEW public.vw_customer_summary_mat;
SELECT COUNT(*) as customer_summary_count FROM public.vw_customer_summary_mat;

REFRESH MATERIALIZED VIEW public.vw_staff_overview_mat;
SELECT COUNT(*) as staff_overview_count FROM public.vw_staff_overview_mat;

REFRESH MATERIALIZED VIEW public.daily_dashboard_kpis;
SELECT COUNT(*) as dashboard_kpis_count FROM public.daily_dashboard_kpis;

REFRESH MATERIALIZED VIEW public.vw_customer_summary;
SELECT COUNT(*) as customer_summary_v2_count FROM public.vw_customer_summary;
