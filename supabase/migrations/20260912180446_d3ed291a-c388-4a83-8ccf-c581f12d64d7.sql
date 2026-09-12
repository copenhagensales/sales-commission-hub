alter table public.ramp_flag_action
  add column if not exists focus_area text,
  add column if not exists focus_note text,
  add column if not exists strength_note text;