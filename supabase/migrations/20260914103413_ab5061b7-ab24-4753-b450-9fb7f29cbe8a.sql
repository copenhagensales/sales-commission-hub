
REVOKE EXECUTE ON FUNCTION public.is_quality_controller(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.quality_can_view_all(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.quality_my_leader_team_ids(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.quality_has_module_access(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.quality_sales_scope(date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_quality_queue(date[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_quality_overview(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_quality_reviewer_stats(date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.quality_mark_uncontrolled(date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quality_block_mutation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.quality_touch_updated_at() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_quality_controller(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quality_can_view_all(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quality_my_leader_team_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.quality_has_module_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quality_queue(date[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quality_overview(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_quality_reviewer_stats(date) TO authenticated;
