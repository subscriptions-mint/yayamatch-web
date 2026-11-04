-- 0004 (Nov 4, 2026): from Supabase's security check. The helper functions behind the access rules can be called
-- directly through the API, so a signed-in user could ask about other people (who blocked whom, who bought a pass).
-- They now answer only about the caller (or for an admin). Every rule and RPC already passes the caller's own id.

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or auth.uid() in (a, b) or public.is_admin())
     and exists (select 1 from public.blocks where (user_id = a and blocked_id = b) or (user_id = b and blocked_id = a));
$$;

create or replace function public.has_pass(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or uid = auth.uid() or public.is_admin())
     and exists (select 1 from public.purchases where user_id = uid and status = 'paid'
                 and item in ('pass', 'premium') and (expires_at is null or expires_at > now()));
$$;

create or replace function public.is_premium(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or uid = auth.uid() or public.is_admin())
     and exists (select 1 from public.purchases where user_id = uid and status = 'paid'
                 and item = 'premium' and (expires_at is null or expires_at > now()));
$$;

create or replace function public.likes_today(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null or uid = auth.uid() or public.is_admin() then (
    select count(*)::int from public.likes l
    join public.profiles p on p.id = l.to_id
    where l.from_id = uid and p.side = 'yaya'
      and l.created_at >= date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila'
  ) else 0 end;
$$;

create or replace function public.chat_unlocked(fam uuid, helper uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or fam = auth.uid() or public.is_admin())
     and (public.has_pass(fam) or exists (
       select 1 from public.purchases where user_id = fam and status = 'paid' and item = 'chat_unlock' and target_id = helper));
$$;

create or replace function public.report_unlocked(fam uuid, helper uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select (auth.uid() is null or fam = auth.uid() or public.is_admin())
     and (public.is_premium(fam) or exists (
       select 1 from public.purchases where user_id = fam and status = 'paid' and item = 'report' and target_id = helper));
$$;

-- Trigger functions are never called through the API.
revoke execute on function public.guard_profile() from authenticated, anon, public;
