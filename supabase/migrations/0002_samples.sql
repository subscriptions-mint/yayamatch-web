-- 0002 (Nov 2, 2026): card fields the screens already use, sample profiles, and the two shared sample sign-ins.
--
-- Sample profiles (profiles.is_seed): the 29 people from src/data. Real users see them with a "Sample profile" tag.
--   They like back right away and answer the first two messages, so a tester can walk the whole flow.
--   Nobody signs in as them (each has a random password nobody knows).
-- Shared sample sign-ins (profiles.demo_login): Kristine (yaya) and the Santos family. Anyone with the sample password
--   can sign in as them, so they live in a sandbox: they only see and meet sample profiles, real users never see them,
--   their ID checks and payments always run in test mode, and reset_my_demo() puts them back to a clean start.

alter table public.families add column if not exists house_rule text;
alter table public.families add column if not exists transport boolean not null default false;
alter table public.helpers add column if not exists gender text check (gender in ('f', 'm'));
alter table public.helpers add column if not exists years_total int;
alter table public.helpers add column if not exists schedule text;
alter table public.helpers add column if not exists top_pick boolean not null default false;
alter table public.profiles add column if not exists demo_login boolean not null default false;

-- Clean-start copy of each shared sign-in's card and checks, used by reset_my_demo(). Server only: no policies.
create table if not exists public.demo_cards (
  id uuid primary key references public.profiles(id) on delete cascade,
  card jsonb not null,
  checks jsonb not null default '[]'
);
alter table public.demo_cards enable row level security;

-- Users can't flag themselves as a sample or a shared sign-in (that would also switch their ID check to test mode).
create or replace function public.guard_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.role := old.role;
    new.is_seed := old.is_seed;
    new.seed_likes_new := old.seed_likes_new;
    new.demo_login := old.demo_login;
    if old.side is not null then new.side := old.side; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.is_demo(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select demo_login from public.profiles where id = uid), false);
$$;

create or replace function public.is_sample(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_seed and not demo_login from public.profiles where id = uid), false);
$$;

-- Shared sign-ins see only sample cards; everyone else never sees a shared sign-in's card.
create or replace function public.can_see_card(card uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case when public.is_demo(auth.uid()) then public.is_sample(card) else not public.is_demo(card) end;
$$;

drop policy if exists families_select on public.families;
create policy families_select on public.families for select to authenticated
  using (id = auth.uid() or public.is_admin() or (visible and not public.is_blocked_between(auth.uid(), id) and public.can_see_card(id)));
drop policy if exists helpers_select on public.helpers;
create policy helpers_select on public.helpers for select to authenticated
  using (id = auth.uid() or public.is_admin() or (visible and not public.is_blocked_between(auth.uid(), id) and public.can_see_card(id)));

create or replace function public.like_profile(target uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  my_side text;
  their_side text;
  m_id uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  select side into my_side from profiles where id = me;
  select side into their_side from profiles where id = target;
  if my_side is null or their_side is null or my_side = their_side then raise exception 'invalid target'; end if;
  -- sandbox: shared sign-ins only meet sample profiles, and real users can't reach a shared sign-in
  if is_demo(me) and not is_sample(target) then return jsonb_build_object('result', 'blocked'); end if;
  if not is_demo(me) and is_demo(target) then raise exception 'invalid target'; end if;
  if is_blocked_between(me, target) then return jsonb_build_object('result', 'blocked'); end if;
  if exists (select 1 from likes where from_id = me and to_id = target) then
    select id into m_id from matches where (family_id = me and helper_id = target) or (family_id = target and helper_id = me);
    return jsonb_build_object('result', case when m_id is null then 'liked' else 'match' end, 'match_id', m_id);
  end if;
  if my_side = 'family' and not has_pass(me) and likes_today(me) >= 10 then
    return jsonb_build_object('result', 'limit');
  end if;
  insert into likes (from_id, to_id) values (me, target) on conflict do nothing;
  delete from passes where user_id = me and target_id = target;
  -- sample profiles like back right away so testers can walk the whole flow
  if is_sample(target) and not is_sample(me) then
    insert into likes (from_id, to_id) values (target, me) on conflict do nothing;
  end if;
  if exists (select 1 from likes where from_id = target and to_id = me) then
    insert into matches (family_id, helper_id)
    values (case when my_side = 'family' then me else target end, case when my_side = 'family' then target else me end)
    on conflict (family_id, helper_id) do nothing
    returning id into m_id;
    if m_id is null then
      select id into m_id from matches where (family_id = me and helper_id = target) or (family_id = target and helper_id = me);
    else
      insert into messages (match_id, kind, body) values (m_id, 'system', 'matched');
      update matches set last_message_at = now() where id = m_id;
    end if;
    return jsonb_build_object('result', 'match', 'match_id', m_id);
  end if;
  return jsonb_build_object('result', 'liked');
end $$;

create or replace function public.finish_onboarding() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s text;
begin
  select side into s from profiles where id = me;
  if s is null then raise exception 'pick a side first'; end if;
  update profiles set onboarded = true, updated_at = now() where id = me;
  -- sample profiles marked seed_likes_new like every new user on the other side
  insert into likes (from_id, to_id)
  select p.id, me from profiles p
  where p.is_seed and not p.demo_login and p.seed_likes_new and p.side <> s
  on conflict do nothing;
end $$;

-- New rule: no messages until your own ID check (yaya) or household ID check (family) has passed. Result 'needs_id'.
create or replace function public.can_send(m uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  mt matches%rowtype;
  sent int;
  open_chats int;
begin
  select * into mt from matches where id = m;
  if mt.id is null or (me <> mt.family_id and me <> mt.helper_id) then return 'denied'; end if;
  if is_blocked_between(mt.family_id, mt.helper_id) then return 'blocked'; end if;
  -- both sides need a passed ID check before they can message
  if not exists (select 1 from checks c where c.user_id = me and c.kind in ('id', 'household_id') and c.status = 'passed') then return 'needs_id'; end if;
  if me = mt.helper_id then return 'ok'; end if;
  if chat_unlocked(me, mt.helper_id) then return 'ok'; end if;
  select count(*) into sent from messages where match_id = m and sender_id = me and kind = 'text';
  if sent >= 1 then return 'locked'; end if;
  select count(distinct match_id) into open_chats from messages where sender_id = me and kind = 'text';
  if open_chats >= 3 then return 'capped'; end if;
  return 'ok';
end $$;

-- Fix from 0001: the sample auto-reply count named the messages table's kind column ambiguously.
create or replace function public.send_message(m uuid, body text, kind text default 'text', meta jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  verdict text;
  mt matches%rowtype;
  other uuid;
  new_id uuid;
  reply text;
  other_is_seed boolean;
  my_msgs int;
begin
  if kind not in ('text', 'number', 'plan', 'hired') then raise exception 'bad kind'; end if;
  if length(coalesce(body, '')) > 2000 then raise exception 'too long'; end if;
  verdict := can_send(m);
  if kind = 'text' and verdict <> 'ok' then return jsonb_build_object('result', verdict); end if;
  if kind <> 'text' and verdict in ('denied', 'blocked', 'needs_id') then return jsonb_build_object('result', verdict); end if;
  select * into mt from matches where id = m;
  insert into messages (match_id, sender_id, kind, body, meta) values (m, me, kind, body, coalesce(meta, '{}')) returning id into new_id;
  update matches set last_message_at = now(),
    family_read_at = case when me = mt.family_id then now() else family_read_at end,
    helper_read_at = case when me = mt.helper_id then now() else helper_read_at end
  where id = m;
  -- seed accounts answer the first two messages with a friendly canned reply
  other := case when me = mt.family_id then mt.helper_id else mt.family_id end;
  select is_seed into other_is_seed from profiles where id = other;
  if coalesce(other_is_seed, false) and kind = 'text' then
    select count(*) into my_msgs from messages x where x.match_id = m and x.sender_id = me and x.kind = 'text';
    if my_msgs <= 2 then
      reply := case
        when other = mt.helper_id and my_msgs = 1 then 'Hello po! Salamat po sa message. Opo, interesado po ako. Ano po ang oras ng trabaho at ilang taon po ang mga bata?'
        when other = mt.helper_id then 'Sige po. Pwede po tayong mag-usap muna dito, tapos magkita po tayo kapag okay na sa inyo.'
        when my_msgs = 1 then 'Hi! Salamat sa interes mo. Pwede ka ba sa stay-out, Lunes hanggang Biyernes, 8 AM hanggang 5 PM?'
        else 'Salamat! Ano ang pinakamaagang petsa na pwede kang magsimula?' end;
      insert into messages (match_id, sender_id, kind, body, meta) values (m, other, 'text', reply, '{"auto": true}');
    end if;
  end if;
  return jsonb_build_object('result', 'ok', 'id', new_id);
end $$;

-- Puts a shared sign-in back to a clean start. The app calls it right after a sample sign-in.
create or replace function public.reset_my_demo() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s text; snap public.demo_cards%rowtype;
begin
  select side into s from profiles where id = me and demo_login;
  if s is null then raise exception 'only for the sample sign-ins'; end if;
  delete from matches where family_id = me or helper_id = me;
  delete from likes where from_id = me or to_id = me;
  delete from passes where user_id = me;
  delete from blocks where user_id = me or blocked_id = me;
  delete from purchases where user_id = me;
  delete from reports where reporter_id = me;
  select * into snap from demo_cards where id = me;
  if snap.id is not null then
    if s = 'yaya' then
      delete from helpers where id = me;
      insert into helpers select * from jsonb_populate_record(null::public.helpers, snap.card);
    else
      delete from families where id = me;
      insert into families select * from jsonb_populate_record(null::public.families, snap.card);
    end if;
    delete from checks where user_id = me;
    insert into checks select * from jsonb_populate_recordset(null::public.checks, snap.checks);
  end if;
  update profiles set onboarded = true, phone = null where id = me;
  insert into likes (from_id, to_id)
  select p.id, me from profiles p
  where p.is_seed and not p.demo_login and p.seed_likes_new and p.side <> s
  on conflict do nothing;
end $$;

-- Which cards are sample profiles, so the app can tag them without reading the private profiles rows.
create or replace function public.sample_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where is_seed and not demo_login;
$$;

-- Admin switch: show or hide every sample card at once (for launch day). Returns how many cards changed.
create or replace function public.set_samples_visible(v boolean) returns int
language plpgsql security definer set search_path = public as $$
declare a int; b int;
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
  update public.helpers set visible = v where public.is_sample(id) and visible <> v;
  get diagnostics a = row_count;
  update public.families set visible = v where public.is_sample(id) and visible <> v;
  get diagnostics b = row_count;
  return a + b;
end $$;

revoke execute on function public.is_demo(uuid), public.is_sample(uuid), public.can_see_card(uuid),
  public.reset_my_demo(), public.sample_ids(), public.set_samples_visible(boolean) from public, anon;
grant execute on function public.is_demo(uuid), public.is_sample(uuid), public.can_see_card(uuid),
  public.reset_my_demo(), public.sample_ids(), public.set_samples_visible(boolean) to authenticated;
