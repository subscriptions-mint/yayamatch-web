-- Personal test accounts for the owner (Nov 6, 2026): one yaya (test.yaya@example.com), one homeowner (test.homeowner@example.com).
-- Normal accounts: not shared samples, never reset. Sign in on staging with "Have a test account? Sign in with a password".
-- Replace __YAYA_PASSWORD__ and __HOMEOWNER_PASSWORD__ before running (passwords are never committed). Safe to re-run: it recreates both accounts.
begin;
delete from auth.users where email in ('test.yaya@example.com', 'test.homeowner@example.com');

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token) values
  ('00000000-0000-0000-0000-000000000000', '994dfe51-cd19-47ba-b1e1-5efaa892c24c', 'authenticated', 'authenticated', 'test.yaya@example.com', extensions.crypt('__YAYA_PASSWORD__', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Andrea Santiago"}', now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'ac14723f-7951-4f4a-8f98-1bea29fd9341', 'authenticated', 'authenticated', 'test.homeowner@example.com', extensions.crypt('__HOMEOWNER_PASSWORD__', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Navarro family"}', now(), now(), '', '', '', '', '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
from auth.users u where u.id in ('994dfe51-cd19-47ba-b1e1-5efaa892c24c', 'ac14723f-7951-4f4a-8f98-1bea29fd9341');

update public.profiles set side = 'yaya', display_name = 'Andrea Santiago', lang = 'tl', onboarded = true where id = '994dfe51-cd19-47ba-b1e1-5efaa892c24c';
update public.profiles set side = 'family', display_name = 'Navarro family', lang = 'en', onboarded = true where id = 'ac14723f-7951-4f4a-8f98-1bea29fd9341';

insert into public.helpers (id, first_name, last_initial, age, gender, city, region, roles, years, years_total, skills, cared_for, languages, rate, arrangement, days_off, cities, start_in, bio, visible)
values ('994dfe51-cd19-47ba-b1e1-5efaa892c24c', 'Andrea', 'S', 29, 'f', 'qc', 'ncr', '{nanny,housekeeper}', '{"nanny": 6, "housekeeper": 2}', 8, '{childcare,cooking,laundry,tutoring}', '{baby,toddler}', '{tagalog,english}',
        13000, 'live-in', '{sun}', '{qc,makati,pasig}', '2w', 'Anim na taon akong yaya ng dalawang bata sa Diliman. Mahilig akong magluto ng masustansyang pagkain at maayos ako sa bahay.', true);

insert into public.families (id, family_name, city, region, needs, kids, elder, pets, languages, arrangement, schedule, rest_days, budget_min, budget_max, perks, start_date, about, origin, household_size, visible)
values ('ac14723f-7951-4f4a-8f98-1bea29fd9341', 'Navarro', 'makati', 'ncr', '{nanny,housekeeper}', '{2,5}', false, '{}', '{tagalog,english}', 'live-in', 'full', '{sun}', 12000, 16000, '{ownRoom}', '2026-12-01',
        'Two working parents in Makati with two kids, 2 and 5. We are looking for a caring live-in yaya who can also help keep the house tidy.', 'filipino', 4, true);

insert into public.checks (user_id, kind, status, id_type, checked_on, age_ok, vendor, note) values
  ('994dfe51-cd19-47ba-b1e1-5efaa892c24c', 'phone', 'passed', null, current_date, null, 'sample', 'Test account: marked as checked, no real check'),
  ('994dfe51-cd19-47ba-b1e1-5efaa892c24c', 'id', 'passed', 'philid', current_date, true, 'sample', 'Test account: marked as checked, no real check'),
  ('ac14723f-7951-4f4a-8f98-1bea29fd9341', 'phone', 'passed', null, current_date, null, 'sample', 'Test account: marked as checked, no real check'),
  ('ac14723f-7951-4f4a-8f98-1bea29fd9341', 'household_id', 'passed', 'philid', current_date, true, 'sample', 'Test account: marked as checked, no real check');

-- the homeowner can chat freely: Premium for 30 days, recorded as a test purchase (no money)
insert into public.purchases (user_id, item, amount, status, provider, provider_ref, method, paid_at, expires_at)
values ('ac14723f-7951-4f4a-8f98-1bea29fd9341', 'premium', 399, 'paid', 'sample', 'TEST-ACCOUNT', 'qrph', now(), now() + interval '30 days');

-- likes both ways = matches; plus a few one-way likes for "liked you"
insert into public.likes (from_id, to_id) values
  ('994dfe51-cd19-47ba-b1e1-5efaa892c24c', 'a2e725f0-4e4b-47d5-a2ae-f60f600ae698'), ('a2e725f0-4e4b-47d5-a2ae-f60f600ae698', '994dfe51-cd19-47ba-b1e1-5efaa892c24c'), ('994dfe51-cd19-47ba-b1e1-5efaa892c24c', '86e32c90-aaf3-4c48-ac8b-261b434b0884'), ('86e32c90-aaf3-4c48-ac8b-261b434b0884', '994dfe51-cd19-47ba-b1e1-5efaa892c24c'),
  ('994dfe51-cd19-47ba-b1e1-5efaa892c24c', 'a5013188-2e69-4220-abed-ba99e895f957'), ('a5013188-2e69-4220-abed-ba99e895f957', '994dfe51-cd19-47ba-b1e1-5efaa892c24c'), ('994dfe51-cd19-47ba-b1e1-5efaa892c24c', '3a58d9f8-bf7b-4d83-a542-ff42bdaaa948'), ('3a58d9f8-bf7b-4d83-a542-ff42bdaaa948', '994dfe51-cd19-47ba-b1e1-5efaa892c24c'),
  ('17413608-e5f3-4b5e-a51d-79cdc6c74fe9', '994dfe51-cd19-47ba-b1e1-5efaa892c24c'), ('42b23abf-7a61-4c55-ab76-d3c0922dd92f', '994dfe51-cd19-47ba-b1e1-5efaa892c24c'),
  ('ac14723f-7951-4f4a-8f98-1bea29fd9341', '42f5c2e7-d3b2-409e-aee0-f4782cfed5d7'), ('42f5c2e7-d3b2-409e-aee0-f4782cfed5d7', 'ac14723f-7951-4f4a-8f98-1bea29fd9341'), ('ac14723f-7951-4f4a-8f98-1bea29fd9341', 'c78cd49d-c1d8-4b24-a811-ae40c668b9a6'), ('c78cd49d-c1d8-4b24-a811-ae40c668b9a6', 'ac14723f-7951-4f4a-8f98-1bea29fd9341'),
  ('ac14723f-7951-4f4a-8f98-1bea29fd9341', '1a816087-1c4b-4ab5-ae8b-8827108a0538'), ('1a816087-1c4b-4ab5-ae8b-8827108a0538', 'ac14723f-7951-4f4a-8f98-1bea29fd9341'), ('ac14723f-7951-4f4a-8f98-1bea29fd9341', '2d3dbb7a-4373-4a92-a836-2eb5de81718d'), ('2d3dbb7a-4373-4a92-a836-2eb5de81718d', 'ac14723f-7951-4f4a-8f98-1bea29fd9341'),
  ('98bb9674-a4d3-431f-a616-ca30e3cf0732', 'ac14723f-7951-4f4a-8f98-1bea29fd9341'), ('fb042f60-9f1d-4c80-ac52-ac4ee0cd03fe', 'ac14723f-7951-4f4a-8f98-1bea29fd9341'),
  ('ac14723f-7951-4f4a-8f98-1bea29fd9341', '994dfe51-cd19-47ba-b1e1-5efaa892c24c'), ('994dfe51-cd19-47ba-b1e1-5efaa892c24c', 'ac14723f-7951-4f4a-8f98-1bea29fd9341')
on conflict do nothing;

insert into public.matches (family_id, helper_id, created_at) values
  ('a2e725f0-4e4b-47d5-a2ae-f60f600ae698', '994dfe51-cd19-47ba-b1e1-5efaa892c24c', now() - interval '3 hours'), ('86e32c90-aaf3-4c48-ac8b-261b434b0884', '994dfe51-cd19-47ba-b1e1-5efaa892c24c', now() - interval '1 day'),
  ('a5013188-2e69-4220-abed-ba99e895f957', '994dfe51-cd19-47ba-b1e1-5efaa892c24c', now() - interval '2 days'), ('3a58d9f8-bf7b-4d83-a542-ff42bdaaa948', '994dfe51-cd19-47ba-b1e1-5efaa892c24c', now() - interval '2 days'),
  ('ac14723f-7951-4f4a-8f98-1bea29fd9341', '42f5c2e7-d3b2-409e-aee0-f4782cfed5d7', now() - interval '1 day'), ('ac14723f-7951-4f4a-8f98-1bea29fd9341', 'c78cd49d-c1d8-4b24-a811-ae40c668b9a6', now() - interval '5 hours'),
  ('ac14723f-7951-4f4a-8f98-1bea29fd9341', '1a816087-1c4b-4ab5-ae8b-8827108a0538', now() - interval '2 days'), ('ac14723f-7951-4f4a-8f98-1bea29fd9341', '2d3dbb7a-4373-4a92-a836-2eb5de81718d', now() - interval '2 days'),
  ('ac14723f-7951-4f4a-8f98-1bea29fd9341', '994dfe51-cd19-47ba-b1e1-5efaa892c24c', now() - interval '10 minutes')
on conflict (family_id, helper_id) do nothing;

-- a few starter messages so both inboxes have something in them
with m as (select id, family_id, helper_id from public.matches)
insert into public.messages (match_id, sender_id, kind, body, created_at)
select m.id, v.sender::uuid, 'text', v.body, now() - v.ago::interval from m join (values
  ('a2e725f0-4e4b-47d5-a2ae-f60f600ae698', '994dfe51-cd19-47ba-b1e1-5efaa892c24c', 'a2e725f0-4e4b-47d5-a2ae-f60f600ae698', 'Hi Andrea! Nakita namin ang profile mo. Pwede ka ba sa live-in sa Quezon City, Lunes hanggang Sabado?', '2 hours'),
  ('86e32c90-aaf3-4c48-ac8b-261b434b0884', '994dfe51-cd19-47ba-b1e1-5efaa892c24c', '994dfe51-cd19-47ba-b1e1-5efaa892c24c', 'Magandang araw po! Interesado po ako sa trabaho ninyo.', '20 hours'),
  ('86e32c90-aaf3-4c48-ac8b-261b434b0884', '994dfe51-cd19-47ba-b1e1-5efaa892c24c', '86e32c90-aaf3-4c48-ac8b-261b434b0884', 'Salamat, Andrea! Ilang taon ang pinakabatang inalagaan mo?', '19 hours'),
  ('ac14723f-7951-4f4a-8f98-1bea29fd9341', '42f5c2e7-d3b2-409e-aee0-f4782cfed5d7', 'ac14723f-7951-4f4a-8f98-1bea29fd9341', 'Hi Rosalinda! We are the Navarro family in Makati. Are you open to a live-in job from Dec 1?', '22 hours'),
  ('ac14723f-7951-4f4a-8f98-1bea29fd9341', '42f5c2e7-d3b2-409e-aee0-f4782cfed5d7', '42f5c2e7-d3b2-409e-aee0-f4782cfed5d7', 'Hello po! Salamat po sa message. Opo, interesado po ako. Ano po ang oras ng trabaho at ilang taon po ang mga bata?', '21 hours'),
  ('ac14723f-7951-4f4a-8f98-1bea29fd9341', 'c78cd49d-c1d8-4b24-a811-ae40c668b9a6', 'c78cd49d-c1d8-4b24-a811-ae40c668b9a6', 'Hello po! Nakita ko po na naghahanap kayo ng yaya sa Makati. Available po ako simula Dec 1.', '4 hours')
) as v(fam, helper, sender, body, ago) on m.family_id = v.fam::uuid and m.helper_id = v.helper::uuid;

update public.matches mt set last_message_at = x.last,
  family_read_at = case when mt.family_id = 'ac14723f-7951-4f4a-8f98-1bea29fd9341' then (select max(created_at) from public.messages where match_id = mt.id and sender_id = 'ac14723f-7951-4f4a-8f98-1bea29fd9341') else x.last end,
  helper_read_at = case when mt.helper_id = '994dfe51-cd19-47ba-b1e1-5efaa892c24c' then (select max(created_at) from public.messages where match_id = mt.id and sender_id = '994dfe51-cd19-47ba-b1e1-5efaa892c24c') else x.last end
from (select match_id, max(created_at) as last from public.messages group by match_id) x
where x.match_id = mt.id and (mt.family_id = 'ac14723f-7951-4f4a-8f98-1bea29fd9341' or mt.helper_id = '994dfe51-cd19-47ba-b1e1-5efaa892c24c');

commit;

select p.email, p.side, p.onboarded,
  (select count(*) from public.matches where family_id = p.id or helper_id = p.id) as matches,
  (select count(*) from public.likes l where l.to_id = p.id and not exists (select 1 from public.likes b where b.from_id = p.id and b.to_id = l.from_id)) as liked_you_only,
  (select count(*) from public.messages x join public.matches mm on mm.id = x.match_id where mm.family_id = p.id or mm.helper_id = p.id) as messages,
  (select string_agg(kind || ':' || status, ', ') from public.checks where user_id = p.id) as checks
from public.profiles p where p.id in ('994dfe51-cd19-47ba-b1e1-5efaa892c24c', 'ac14723f-7951-4f4a-8f98-1bea29fd9341');
