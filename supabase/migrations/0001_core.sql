-- YayaMatch core schema (Nov 2, 2026)
-- Profiles for both sides, public cards, checks, likes, matches, chat, purchases, hires, reports, blocks.
-- Entitlement rules live in security-definer RPCs so the client cannot bypass them.

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  side text check (side in ('family', 'yaya')),
  lang text not null default 'en' check (lang in ('en', 'tl')),
  display_name text,                 -- full name (private)
  email text,                        -- private
  phone text,                        -- private until shared in chat
  role text not null default 'user' check (role in ('user', 'admin')),
  is_seed boolean not null default false,
  seed_likes_new boolean not null default false,  -- seed accounts that like every new user of the other side
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_side() returns text
language sql stable security definer set search_path = public as $$
  select side from public.profiles where id = auth.uid();
$$;

-- ---------- public cards ----------
create table public.families (
  id uuid primary key references public.profiles(id) on delete cascade,
  family_name text not null default '',
  city text,
  region text,
  needs text[] not null default '{}',
  kids int[] not null default '{}',
  elder boolean not null default false,
  pets text[] not null default '{}',
  languages text[] not null default '{}',
  arrangement text check (arrangement in ('live-in', 'live-out')),
  schedule text not null default 'full' check (schedule in ('full', 'part')),
  rest_days text[] not null default '{}',
  hours text,
  budget_min int,
  budget_max int,
  perks text[] not null default '{}',
  start_date date,
  about text,
  origin text,
  household_size int,
  helper_notes jsonb not null default '[]',
  visible boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.helpers (
  id uuid primary key references public.profiles(id) on delete cascade,
  first_name text not null default '',
  last_initial text not null default '',
  age int check (age is null or age >= 18),
  city text,
  region text,
  roles text[] not null default '{}',
  years jsonb not null default '{}',
  skills text[] not null default '{}',
  cared_for text[] not null default '{}',
  abroad boolean not null default false,
  languages text[] not null default '{}',
  rate int,
  arrangement text check (arrangement in ('live-in', 'live-out', 'either')),
  days_off text[] not null default '{}',
  cities text[] not null default '{}',
  start_in text,
  bio text,
  favorite text,
  photo_path text,
  voice_path text,
  voice_seconds int,
  voice_script text,
  quotes jsonb not null default '[]',
  experience jsonb not null default '[]',
  available_now boolean not null default false,
  available_until timestamptz,
  visible boolean not null default true,
  hired_at timestamptz,
  updated_at timestamptz not null default now()
);

-- ---------- checks (ID, household ID, phone, NBI, references) ----------
create table public.checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('id', 'household_id', 'phone', 'nbi', 'references')),
  status text not null default 'pending' check (status in ('pending', 'passed', 'failed', 'review')),
  id_type text,
  checked_on date,
  valid_until date,
  age_ok boolean,
  detail text,
  vendor text,
  vendor_ref text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

-- ---------- likes, passes, blocks ----------
create table public.likes (
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index likes_to_idx on public.likes (to_id);

create table public.passes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, target_id)
);

create table public.blocks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked_id)
);

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (user_id = a and blocked_id = b) or (user_id = b and blocked_id = a));
$$;

-- ---------- matches and messages ----------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.profiles(id) on delete cascade,
  helper_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz,
  family_read_at timestamptz,
  helper_read_at timestamptz,
  unique (family_id, helper_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'system', 'number', 'plan', 'hired')),
  body text not null default '',
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index messages_match_idx on public.messages (match_id, created_at);

-- ---------- purchases ----------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item text not null check (item in ('chat_unlock', 'pass', 'premium', 'report', 'urgent')),
  target_id uuid references public.profiles(id) on delete set null,
  amount int not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  provider text not null default 'paymongo',
  provider_ref text,
  checkout_url text,
  method text,
  paid_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index purchases_user_idx on public.purchases (user_id, status);

-- ---------- hires ----------
create table public.hires (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null unique references public.matches(id) on delete cascade,
  family_id uuid not null references public.profiles(id) on delete cascade,
  helper_id uuid not null references public.profiles(id) on delete cascade,
  start_date date,
  family_confirmed boolean not null default false,
  helper_confirmed boolean not null default false,
  checklist jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- reports ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  note text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id)
);

-- ---------- entitlement helpers ----------
create or replace function public.has_pass(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.purchases where user_id = uid and status = 'paid'
                 and item in ('pass', 'premium') and (expires_at is null or expires_at > now()));
$$;

create or replace function public.is_premium(uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.purchases where user_id = uid and status = 'paid'
                 and item = 'premium' and (expires_at is null or expires_at > now()));
$$;

create or replace function public.likes_today(uid uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.likes l
  join public.profiles p on p.id = l.to_id
  where l.from_id = uid and p.side = 'yaya'
    and l.created_at >= date_trunc('day', now() at time zone 'Asia/Manila') at time zone 'Asia/Manila';
$$;

create or replace function public.chat_unlocked(fam uuid, helper uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_pass(fam) or exists (
    select 1 from public.purchases where user_id = fam and status = 'paid' and item = 'chat_unlock' and target_id = helper);
$$;

create or replace function public.report_unlocked(fam uuid, helper uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_premium(fam) or exists (
    select 1 from public.purchases where user_id = fam and status = 'paid' and item = 'report' and target_id = helper);
$$;

-- ---------- RPC: like ----------
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
  -- seed accounts like back right away so testers can walk the whole flow
  if exists (select 1 from profiles where id = target and is_seed) and not exists (select 1 from profiles where id = me and is_seed) then
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

create or replace function public.pass_profile(target uuid) returns void
language sql security definer set search_path = public as $$
  insert into passes (user_id, target_id) values (auth.uid(), target) on conflict do nothing;
$$;

create or replace function public.unpass_profile(target uuid) returns void
language sql security definer set search_path = public as $$
  delete from passes where user_id = auth.uid() and target_id = target;
$$;

-- ---------- RPC: chat ----------
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
  if me = mt.helper_id then return 'ok'; end if;
  if chat_unlocked(me, mt.helper_id) then return 'ok'; end if;
  select count(*) into sent from messages where match_id = m and sender_id = me and kind = 'text';
  if sent >= 1 then return 'locked'; end if;
  select count(distinct match_id) into open_chats from messages where sender_id = me and kind = 'text';
  if open_chats >= 3 then return 'capped'; end if;
  return 'ok';
end $$;

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
  if kind <> 'text' and verdict in ('denied', 'blocked') then return jsonb_build_object('result', verdict); end if;
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

create or replace function public.mark_read(m uuid) returns void
language sql security definer set search_path = public as $$
  update matches set
    family_read_at = case when family_id = auth.uid() then now() else family_read_at end,
    helper_read_at = case when helper_id = auth.uid() then now() else helper_read_at end
  where id = m and (family_id = auth.uid() or helper_id = auth.uid());
$$;

-- ---------- RPC: hire ----------
create or replace function public.mark_hired(m uuid, start date default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare mt matches%rowtype; h uuid;
begin
  select * into mt from matches where id = m and family_id = auth.uid();
  if mt.id is null then raise exception 'not your match'; end if;
  insert into hires (match_id, family_id, helper_id, start_date, family_confirmed)
  values (m, mt.family_id, mt.helper_id, start, true)
  on conflict (match_id) do update set family_confirmed = true, start_date = coalesce(excluded.start_date, hires.start_date)
  returning id into h;
  insert into messages (match_id, sender_id, kind, body) values (m, auth.uid(), 'hired', 'hired');
  update matches set last_message_at = now() where id = m;
  return h;
end $$;

create or replace function public.confirm_hired(m uuid) returns void
language plpgsql security definer set search_path = public as $$
declare mt matches%rowtype;
begin
  select * into mt from matches where id = m and helper_id = auth.uid();
  if mt.id is null then raise exception 'not your match'; end if;
  update hires set helper_confirmed = true where match_id = m;
  update helpers set hired_at = now(), visible = false where id = auth.uid();
end $$;

create or replace function public.toggle_checklist(h uuid, item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare cl jsonb;
begin
  update hires set checklist = case when coalesce((checklist->>item)::boolean, false)
                                    then checklist - item else checklist || jsonb_build_object(item, true) end
  where id = h and family_id = auth.uid()
  returning checklist into cl;
  return cl;
end $$;

-- ---------- RPC: onboarding ----------
create or replace function public.finish_onboarding() returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); s text;
begin
  select side into s from profiles where id = me;
  if s is null then raise exception 'pick a side first'; end if;
  update profiles set onboarded = true, updated_at = now() where id = me;
  -- seed accounts marked seed_likes_new like every new real user on the other side
  insert into likes (from_id, to_id)
  select p.id, me from profiles p
  where p.is_seed and p.seed_likes_new and p.side <> s
  on conflict do nothing;
end $$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.helpers enable row level security;
alter table public.checks enable row level security;
alter table public.likes enable row level security;
alter table public.passes enable row level security;
alter table public.blocks enable row level security;
alter table public.matches enable row level security;
alter table public.messages enable row level security;
alter table public.purchases enable row level security;
alter table public.hires enable row level security;
alter table public.reports enable row level security;

-- profiles: own row; admins read all
create policy profiles_select on public.profiles for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_update on public.profiles for update to authenticated using (public.is_admin());

-- prevent users from promoting themselves or flagging seeds
create or replace function public.guard_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and auth.uid() is not null then
    new.role := old.role;
    new.is_seed := old.is_seed;
    new.seed_likes_new := old.seed_likes_new;
    if old.side is not null then new.side := old.side; end if;
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.guard_profile();

-- cards: readable by signed-in users unless blocked; owner writes own card
create policy families_select on public.families for select to authenticated
  using (id = auth.uid() or public.is_admin() or (visible and not public.is_blocked_between(auth.uid(), id)));
create policy families_insert on public.families for insert to authenticated with check (id = auth.uid() and public.my_side() = 'family');
create policy families_update on public.families for update to authenticated using (id = auth.uid() or public.is_admin());

create policy helpers_select on public.helpers for select to authenticated
  using (id = auth.uid() or public.is_admin() or (visible and not public.is_blocked_between(auth.uid(), id)));
create policy helpers_insert on public.helpers for insert to authenticated with check (id = auth.uid() and public.my_side() = 'yaya');
create policy helpers_update on public.helpers for update to authenticated using (id = auth.uid() or public.is_admin());

-- checks: passed checks are public (limited columns); owners see their own; writes only by server or admin
create policy checks_select on public.checks for select to authenticated using (status = 'passed' or user_id = auth.uid() or public.is_admin());
create policy checks_admin_update on public.checks for update to authenticated using (public.is_admin());

-- likes: you see likes you sent; likes you received if you are a yaya, have a pass, or are admin
create policy likes_select on public.likes for select to authenticated
  using (from_id = auth.uid() or (to_id = auth.uid() and (public.my_side() = 'yaya' or public.has_pass(auth.uid()))) or public.is_admin());

create policy passes_all on public.passes for select to authenticated using (user_id = auth.uid());
create policy blocks_select on public.blocks for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy blocks_insert on public.blocks for insert to authenticated with check (user_id = auth.uid());
create policy blocks_delete on public.blocks for delete to authenticated using (user_id = auth.uid());

create policy matches_select on public.matches for select to authenticated using (family_id = auth.uid() or helper_id = auth.uid() or public.is_admin());
create policy messages_select on public.messages for select to authenticated using (
  public.is_admin() or exists (select 1 from public.matches m where m.id = match_id and (m.family_id = auth.uid() or m.helper_id = auth.uid())));

create policy purchases_select on public.purchases for select to authenticated using (user_id = auth.uid() or public.is_admin());

create policy hires_select on public.hires for select to authenticated using (family_id = auth.uid() or helper_id = auth.uid() or public.is_admin());

create policy reports_insert on public.reports for insert to authenticated with check (reporter_id = auth.uid());
create policy reports_select on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy reports_admin_update on public.reports for update to authenticated using (public.is_admin());

-- ---------- grants ----------
grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.families, public.helpers to authenticated;
grant select (id, user_id, kind, status, id_type, checked_on, valid_until, age_ok, detail, created_at, updated_at) on public.checks to authenticated;
grant update (status, note, updated_at) on public.checks to authenticated;
grant select on public.likes, public.passes, public.matches, public.messages, public.purchases, public.hires to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select, insert, update on public.reports to authenticated;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.handle_new_user() from authenticated, anon, public;

-- ---------- realtime ----------
alter publication supabase_realtime add table public.messages, public.matches, public.likes, public.purchases, public.checks;

-- ---------- storage ----------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true), ('voice', 'voice', true) on conflict (id) do nothing;
create policy "own uploads insert" on storage.objects for insert to authenticated
  with check (bucket_id in ('photos', 'voice') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own uploads update" on storage.objects for update to authenticated
  using (bucket_id in ('photos', 'voice') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own uploads delete" on storage.objects for delete to authenticated
  using (bucket_id in ('photos', 'voice') and (storage.foldername(name))[1] = auth.uid()::text);
