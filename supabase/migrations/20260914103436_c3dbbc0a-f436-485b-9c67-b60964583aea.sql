
GRANT EXECUTE ON FUNCTION public.quality_sales_scope(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.quality_mark_uncontrolled(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_quality_queue(date[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_quality_overview(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_quality_reviewer_stats(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_quality_controller(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.quality_can_view_all(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.quality_my_leader_team_ids(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.quality_has_module_access(uuid) TO service_role;
