-- 0003 (Nov 2, 2026): three small additions the live web app uses. Not applied yet: for the owner to review.
-- The app works without them (it falls back as noted), but each one fixes something users would notice.

-- 1. Families without a pass can't read who liked them (likes_select, by design), so the app could not show
--    "4 helpers already liked your family" or the Likes badge. This returns only the number, never who.
--    Without it: no banner and no count until the family buys a pass.
create or replace function public.likes_received_count() returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.likes l
  where l.to_id = auth.uid()
    and not public.is_blocked_between(auth.uid(), l.from_id)
    and not exists (select 1 from public.matches m where (m.family_id = auth.uid() and m.helper_id = l.from_id) or (m.helper_id = auth.uid() and m.family_id = l.from_id));
$$;

-- 2. Admin console, "ID reviews": passing a check must also date it (checks always show dates).
--    The column grants only allow admins to update status / note / updated_at, so checked_on can't be set from the app.
--    Without it: the app sets status only, and shows the month of updated_at instead of checked_on.
create or replace function public.admin_review_check(check_id uuid, decision text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  if decision not in ('passed', 'failed') then raise exception 'bad decision'; end if;
  update public.checks
     set status = decision,
         checked_on = case when decision = 'passed' then (now() at time zone 'Asia/Manila')::date else null end,
         updated_at = now()
   where id = check_id and status = 'review';
end $$;

-- 3. Once a yaya confirms a hire, confirm_hired() sets helpers.visible = false, and helpers_select then hides her card
--    from the family she just matched with (their chat and hiring checklist lose her name and photo).
--    These extra policies let the two people in a match keep seeing each other's card. Blocks still win.
--    Without it: the app keeps the last card it saw on that device, or shows a plain placeholder.
drop policy if exists helpers_select_matched on public.helpers;
create policy helpers_select_matched on public.helpers for select to authenticated using (
  not public.is_blocked_between(auth.uid(), id)
  and exists (select 1 from public.matches m where m.family_id = auth.uid() and m.helper_id = helpers.id));
drop policy if exists families_select_matched on public.families;
create policy families_select_matched on public.families for select to authenticated using (
  not public.is_blocked_between(auth.uid(), id)
  and exists (select 1 from public.matches m where m.helper_id = auth.uid() and m.family_id = families.id));

revoke execute on function public.likes_received_count(), public.admin_review_check(uuid, text) from public, anon;
grant execute on function public.likes_received_count(), public.admin_review_check(uuid, text) to authenticated;
