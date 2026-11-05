# More sample profiles for the live app (Nov 5, 2026): 12 yayas and 12 homeowners on top of the 29 from src/data.
# Sample profiles show a "Sample profile" tag, like back right away and answer the first two messages.
# Nobody can sign in as them (random passwords). Insert-only and safe to re-run: existing rows are left alone.
# Usage: python3 more_samples.py > more_samples.sql
# Ids: md5 of 'yayamatch-seed:nov5:<id>' (the plain 'yayamatch-seed:<id>' space belongs to the src/data samples).
import hashlib, json

REGION = {'cebu': 'r7', 'davao': 'r11'}


def uid(key):
    h = hashlib.md5(('yayamatch-seed:' + key).encode()).hexdigest()
    return f'{h[0:8]}-{h[8:12]}-4{h[13:16]}-a{h[17:20]}-{h[20:32]}'


def q(v):
    if v is None: return 'null'
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def arr(a): return 'array[' + ', '.join(q(x) for x in a) + ']::text[]'
def iarr(a): return 'array[' + ', '.join(str(x) for x in a) + ']::int[]'
def js(o): return q(json.dumps(o, ensure_ascii=False)) + '::jsonb'
def month(ym): return f'{ym}-01' if ym else None


START = {'now': 'now', '2weeks': '2w', '1month': '1m'}
ARR = {'livein': 'live-in', 'liveout': 'live-out'}

# id, first, initial, gender, age, city, roles, years, rate, arrangement, languages, skills, cared_for, bio, experience,
# schedule, startIn, daysOff, checks, quotes, likedYou, favorite
YAYAS = [
    ('h-17', 'Analyn', 'B', 'f', 29, 'mandaluyong', ['nanny'], 6, 13000, 'liveout', ['tagalog', 'english'], ['childcare', 'firstaid', 'laundry'], ['toddler'],
     'Mahilig ako sa mga bata. May first aid training ako at sanay sa toddler routine: tulog, kain, laro.',
     [{'years': '2021–2026', 'text': 'Nanny for twins, Mandaluyong'}, {'years': '2019–2021', 'text': 'Daycare assistant, Antipolo'}],
     'Mon–Sat · Can start in 2 weeks', '2weeks', ['sun'], {'phone': '2026-10', 'id': ('philid', '2026-10'), 'refs': (2, '2026-10')},
     [{'text': 'Patient with our twins, and kept a clear daily log.', 'who': 'Cruz family · Mandaluyong'}], True,
     'Story time before nap, with funny voices.'),
    ('h-18', 'Marites', 'V', 'f', 46, 'paranaque', ['housekeeper', 'cook'], 15, 14000, 'livein', ['tagalog', 'bisaya'], ['cooking', 'laundry'], [],
     '15 taon na sa mga bahay sa Parañaque at Las Piñas. Maayos sa bahay at masarap magluto ng lutong-bahay.',
     [{'years': '2016–2026', 'text': 'Housekeeper and cook, BF Homes'}, {'years': '2011–2016', 'text': 'Housekeeper, Las Piñas'}],
     'Live-in · Sunday off', '1month', ['sun'], {'phone': '2026-09', 'id': ('umid', '2026-09'), 'nbi': '2027-05', 'refs': (3, '2026-09')},
     [{'text': 'Ten years with us. Our home ran smoothly because of her.', 'who': 'Santiago family · Parañaque'}], False,
     'Sunday-style kare-kare, any day of the week.'),
    ('h-19', 'Joy', 'C', 'f', 24, 'qc', ['allaround'], 3, 10500, 'liveout', ['tagalog', 'english'], ['laundry', 'cooking', 'petcare'], [],
     'Masipag at mabilis matuto. Sanay sa general cleaning, laundry, at pag-aalaga ng aso.',
     [{'years': '2023–2026', 'text': 'All-around helper, Teachers Village, QC'}],
     'Mon–Fri, 8 AM to 5 PM · Available now', 'now', ['sat', 'sun'], {'phone': '2026-10', 'id': ('philid', '2026-10')},
     [{'text': 'Our two dogs love her, and the house was always tidy.', 'who': 'Ramos family · QC'}], True,
     'A freshly folded laundry pile.'),
    ('h-20', 'Teresita', 'M', 'f', 52, 'marikina', ['caregiver'], 18, 16000, 'livein', ['tagalog', 'ilocano'], ['firstaid', 'cooking'], ['elder'],
     'Caregiver para sa mga lolo at lola sa bahay sa loob ng 18 taon. Marunong sa vital signs, gamot, at therapy exercises.',
     [{'years': '2018–2026', 'text': 'Caregiver for a lola with dementia, Marikina'}, {'years': '2008–2018', 'text': 'Home caregiver, Baguio'}],
     'Live-in · Sunday off', '1month', ['sun'], {'phone': '2026-09', 'id': ('philid', '2026-09'), 'nbi': '2027-04', 'refs': (3, '2026-09')},
     [{'text': 'Gentle with my mother, and she kept us updated every day.', 'who': 'Lopez family · Marikina'}], False,
     'Morning walks with my lola, slow and steady.'),
    ('h-21', 'Ronaldo', 'F', 'm', 41, 'makati', ['driver'], 14, 18000, 'liveout', ['tagalog', 'english'], ['driving'], [],
     'Professional driver with 14 years of experience. Alam ko ang Metro Manila routes at maingat ako magmaneho.',
     [{'years': '2017–2026', 'text': 'Family driver, Makati'}, {'years': '2012–2017', 'text': 'Company driver, Ortigas'}],
     'Mon–Sat · Start next month', '1month', ['sun'], {'phone': '2026-10', 'id': ('philid', '2026-10'), 'nbi': '2027-06', 'refs': (2, '2026-10')},
     [{'text': 'Always on time for school runs, and the car is always clean.', 'who': 'Uy family · Makati'}], True,
     'Getting the kids to school before the first bell.'),
    ('h-22', 'Charmaine', 'D', 'f', 27, 'cebu', ['nanny', 'housekeeper'], 5, 9500, 'livein', ['bisaya', 'tagalog', 'english'], ['childcare', 'laundry', 'tutoring'], ['toddler'],
     'Taga-Cebu ko. Kahibalo ko mag-atiman og bata ug motabang sa homework. Patient and organized.',
     [{'years': '2021–2026', 'text': 'Nanny, Lahug, Cebu City'}],
     'Live-in · Sunday off', '2weeks', ['sun'], {'phone': '2026-10', 'id': ('philid', '2026-10'), 'refs': (2, '2026-10')},
     [{'text': 'She helped our son with reading every afternoon.', 'who': 'Go family · Cebu City'}], True,
     'Reading practice with flashcards.'),
    ('h-23', 'Elvira', 'S', 'f', 38, 'davao', ['cook', 'housekeeper'], 10, 9000, 'liveout', ['bisaya', 'tagalog'], ['cooking', 'laundry'], [],
     'Lutong Davao, Bisaya, at Tagalog. Malinis sa kusina at marunong mag-budget sa palengke.',
     [{'years': '2018–2026', 'text': 'Cook and housekeeper, Lanang, Davao'}],
     'Mon–Sat, 7 AM to 4 PM', 'now', ['sun'], {'phone': '2026-09', 'id': ('umid', '2026-09'), 'refs': (2, '2026-09')},
     [{'text': "Her tinolang manok is the best we've had.", 'who': 'Dela Paz family · Davao'}], False,
     'Market runs at dawn for the freshest fish.'),
    ('h-24', 'Princess', 'A', 'f', 22, 'pasig', ['nanny'], 2, 10000, 'liveout', ['tagalog', 'english'], ['childcare', 'tutoring'], ['toddler'],
     'Graduated in education, now a nanny. I like teaching kids colors, numbers and songs.',
     [{'years': '2024–2026', 'text': 'Nanny for a 3-year-old, Kapitolyo'}],
     'Weekdays, 7 AM to 6 PM', '2weeks', ['sat', 'sun'], {'phone': '2026-10', 'id': ('philid', '2026-10')},
     [{'text': 'Our daughter learned her ABCs with her.', 'who': 'Navarro family · Pasig'}], False,
     'Singing the alphabet song in three tunes.'),
    ('h-25', 'Lourdes', 'P', 'f', 44, 'muntinlupa', ['housekeeper'], 12, 13500, 'livein', ['tagalog'], ['laundry', 'cooking', 'petcare'], [],
     'Sanay sa malalaking bahay sa Alabang. Maayos sa paglilinis, paglalaba at pagplantsa.',
     [{'years': '2015–2026', 'text': 'Housekeeper, Ayala Alabang'}, {'years': '2013–2015', 'text': 'Laundry staff, Muntinlupa'}],
     'Live-in · Sunday off', '1month', ['sun'], {'phone': '2026-09', 'id': ('passport', '2026-09'), 'nbi': '2027-02', 'refs': (3, '2026-09')},
     [{'text': 'Our home has never been this organized.', 'who': 'Sy family · Alabang'}], True,
     'Perfectly ironed school uniforms.'),
    ('h-26', 'Jomar', 'T', 'm', 33, 'bgc', ['driver', 'allaround'], 8, 17000, 'liveout', ['tagalog', 'english'], ['driving'], [],
     'Driver and all-around helper. I can do errands, small repairs and grocery runs.',
     [{'years': '2020–2026', 'text': 'Driver and errands, BGC'}, {'years': '2018–2020', 'text': 'Delivery driver, Taguig'}],
     'Mon–Fri · Available now', 'now', ['sat', 'sun'], {'phone': '2026-10', 'id': ('philid', '2026-10'), 'nbi': '2027-01'},
     [{'text': 'Reliable with errands and great with small fixes.', 'who': 'Park family · BGC'}], False,
     'Fixing a squeaky door before anyone notices.'),
    ('h-27', 'Rowena', 'G', 'f', 35, 'sanjuan', ['nanny', 'cook'], 9, 14500, 'livein', ['tagalog', 'english', 'hiligaynon'], ['childcare', 'cooking', 'firstaid'], ['baby', 'toddler'],
     'Nanny at cook para sa pamilyang may tatlong anak. Marunong ako sa baby food at balanced meals para sa mga bata.',
     [{'years': '2017–2026', 'text': 'Nanny and cook, Greenhills'}],
     'Live-in · 1 day off a week', '2weeks', ['sat'], {'phone': '2026-10', 'id': ('umid', '2026-10'), 'refs': (2, '2026-10')},
     [{'text': 'Our kids now eat their vegetables, thanks to her.', 'who': 'Chua family · Greenhills'}], False,
     'Hidden-veggie spaghetti the kids ask for.'),
    ('h-28', 'Nenita', 'O', 'f', 49, 'manila', ['allaround'], 20, 12000, 'livein', ['tagalog', 'ilocano'], ['cooking', 'laundry', 'childcare'], [],
     '20 taon na akong kasambahay. Kaya ko ang lahat ng gawaing bahay, at matagal akong nag-alaga ng pamilya.',
     [{'years': '2010–2026', 'text': 'All-around kasambahay, Malate'}],
     'Live-in · Sunday off', '1month', ['sun'], {'phone': '2026-09', 'id': ('philid', '2026-09'), 'nbi': '2027-03', 'refs': (3, '2026-09')},
     [{'text': 'Sixteen years with our family. She is part of our home.', 'who': 'Aquino family · Malate'}], False,
     'Pancit on everyone’s birthday.'),
]

# id, family, origin, city, size, kids, pets, needs, min, max, arrangement, hours, daysOff, start, bio, houseRule, languages,
# checks (phone, id), extras, notes, likedYou, transport
FAMILIES = [
    ('k-14', 'Salazar', 'filipino', 'qc', 5, [1, 4], [], ['nanny'], 11000, 13000, 'livein', None, ['sun'], '2026-12-01',
     'Two working parents in Quezon City with a baby and a preschooler. We need a nanny who is patient and loves routines.',
     'No screens for the kids before 4 PM.', ['tagalog', 'english'], ('2026-10', '2026-10'), ['ownRoom', 'load'],
     [{'text': 'Kind family, and they always paid on time.', 'who': 'Former nanny · 2 yrs'}], True, False),
    ('k-15', 'Ocampo', 'ofw', 'pasig', 3, [8], ['cat'], ['allaround'], 10000, 12000, 'livein', None, ['sun'], '2026-11-23',
     'Mom works in Dubai; dad and our 8-year-old live in Pasig. We need an all-around helper for the home and school days.',
     'Please keep the house quiet during homework time, 4 to 6 PM.', ['tagalog'], ('2026-10', '2026-10'), ['ownRoom', 'fareHome'],
     [{'text': 'Fair employer and easy to talk to.', 'who': 'Former helper · 4 yrs'}], False, False),
    ('k-16', 'Castillo', 'filipino', 'makati', 3, [], [], ['caregiver'], 15000, 18000, 'livein', None, ['sun'], '2026-12-15',
     'We are arranging care for our father, 84, who lives in Makati with our mother. We need a caregiver who is gentle and calm.',
     'Lolo naps from 1 to 3 PM, so we keep things quiet then.', ['tagalog', 'english'], ('2026-10', '2026-10'), ['ownRoom', 'hmo'],
     [{'text': 'Respectful family who treat you like a relative.', 'who': 'Former caregiver · 5 yrs'}], True, False),
    ('k-17', 'Kim', 'expat', 'bgc', 4, [5, 9], [], ['housekeeper', 'cook'], 16000, 19000, 'liveout', '8:00–17:00', ['sat', 'sun'], None,
     'Korean–Filipino family in BGC. We need help with cleaning and with cooking simple Filipino and Korean dishes.',
     'Shoes off inside, and weekends are always off.', ['english'], ('2026-10', '2026-10'), ['load', 'hmo'], [], False, False),
    ('k-18', 'Morales', 'filipino', 'mandaluyong', 4, [2, 6], ['dog'], ['nanny', 'housekeeper'], 12000, 14000, 'livein', None, ['sun'], '2026-12-01',
     'Young family in Mandaluyong. We are looking for a nanny who can also help keep the house in order.',
     'We eat dinner together at 7 PM, and you are welcome at the table.', ['tagalog', 'english'], ('2026-10', '2026-10'), ['ownRoom', 'load'],
     [{'text': 'They respected my day off every week.', 'who': 'Former nanny · 3 yrs'}], True, False),
    ('k-19', 'Rivera', 'ofw', 'paranaque', 5, [3, 7, 12], [], ['allaround'], 11000, 13000, 'livein', None, ['sun'], '2027-01-05',
     'Dad works on a ship; mom works full-time in Parañaque. Three kids, a busy house and a lot of laughter.',
     'Tuesdays and Thursdays are market days, and we go together.', ['tagalog'], ('2026-09', '2026-09'), ['ownRoom', 'fareHome'], [], False, False),
    ('k-20', 'Lee', 'expat', 'makati', 3, [4], [], ['nanny'], 15000, 18000, 'liveout', '9:00–18:00', ['sat', 'sun'], '2026-11-30',
     'Singaporean family in Salcedo Village with one 4-year-old. We need a nanny who speaks English and enjoys outdoor play.',
     'Park time every afternoon, or indoor play when it rains.', ['english'], ('2026-10', '2026-10'), ['load', 'hmo'], [], False, True),
    ('k-21', 'Domingo', 'filipino', 'marikina', 6, [10, 14], ['dog', 'cat'], ['cook', 'housekeeper'], 12000, 14000, 'livein', None, ['sun'], '2026-12-08',
     'Big family in Marikina, with the grandparents at home. We need someone who enjoys cooking for six.',
     "Grandma's recipes are welcome; she loves to teach them.", ['tagalog'], ('2026-09', '2026-09'), ['ownRoom'],
     [{'text': 'Warm family, and the grandmother taught me her recipes.', 'who': 'Former cook · 6 yrs'}], False, False),
    ('k-22', 'Abellana', 'filipino', 'cebu', 4, [2, 5], [], ['nanny'], 8500, 10000, 'livein', None, ['sun'], '2026-12-01',
     'Taga-Cebu mi. We need a nanny for our two little ones while we run our shop in Mabolo.',
     'We speak Bisaya at home; Tagalog and English are fine too.', ['bisaya', 'english'], ('2026-10', '2026-10'), ['ownRoom', 'load'], [], True, False),
    ('k-23', 'Sarmiento', 'filipino', 'davao', 2, [], ['dog'], ['housekeeper'], 8000, 9500, 'liveout', '8:00–16:00', ['sat', 'sun'], '2026-11-23',
     'Working couple in Matina, Davao. We need help with cleaning, laundry and the dog on weekdays.',
     'Our dog Bruno gets two walks a day.', ['bisaya', 'tagalog'], ('2026-10', '2026-10'), ['load'], [], False, False),
    ('k-24', 'Hernandez', 'filipino', 'sanjuan', 5, [1, 3, 6], [], ['nanny', 'housekeeper'], 13000, 16000, 'livein', None, ['sun'], '2026-12-01',
     'Three kids under seven in Greenhills. We need an extra pair of caring hands, especially for the baby.',
     'The baby sleeps at 7 PM, so we keep the house quiet after that.', ['tagalog', 'english'], ('2026-10', '2026-10'), ['ownRoom', 'hmo', 'load'],
     [{'text': 'Supportive family; they helped me with my SSS papers.', 'who': 'Former nanny · 2 yrs'}], False, False),
    ('k-25', 'Johansson', 'expat', 'bgc', 2, [], ['cat'], ['housekeeper'], 14000, 16000, 'liveout', '9:00–15:00', ['sat', 'sun'], None,
     'Swedish couple in BGC working from home. We need help with cleaning, laundry and plants, three to five days a week.',
     'Quiet hours during our calls, 9 to 11 AM.', ['english'], ('2026-10', '2026-10'), ['load'], [], False, False),
]

users, profiles, helpers, families, checks = [], [], [], [], []


def check(u, kind, id_type=None, checked_on=None, valid_until=None, age_ok=None, detail=None):
    checks.append(f"({q(u)}, {q(kind)}, 'passed', {q(id_type)}, {q(checked_on)}, {q(valid_until)}, {q(age_ok)}, {q(detail)}, 'sample')")


for (hid, first, ini, g, age, city, roles, years, rate, arrg, langs, skills, cared, bio, exp, sched, start, off, c, quotes, liked, fav) in YAYAS:
    u = uid('nov5:' + hid)
    users.append((u, f'{first.lower()}.seed@example.com'))
    profiles.append(f"({q(u)}::uuid, 'yaya', {q(first + ' ' + ini + '.')}, {q(liked)})")
    helpers.append('(' + ', '.join([q(u), q(first), q(ini), str(age), q(city), q(REGION.get(city, 'ncr')), arr(roles), js({roles[0]: years}),
                                     arr(skills), arr(cared), 'false', arr(langs), str(rate), q(ARR[arrg]), arr(off), arr([city]), q(START[start]),
                                     q(bio), q(fav), 'null', 'null', 'null', js(quotes), js(exp), q(g), str(years), q(sched), 'false']) + ')')
    check(u, 'phone', checked_on=month(c['phone']))
    check(u, 'id', id_type=c['id'][0], checked_on=month(c['id'][1]), age_ok=True)
    if 'nbi' in c: check(u, 'nbi', valid_until=month(c['nbi']))
    if 'refs' in c: check(u, 'references', checked_on=month(c['refs'][1]), detail=str(c['refs'][0]))

for (kid, fam, origin, city, size, kids, pets, needs, lo, hi, arrg, hours, off, start, bio, rule, langs, c, extras, notes, liked, transport) in FAMILIES:
    u = uid('nov5:' + kid)
    users.append((u, f'{fam.lower()}.seed@example.com'))
    profiles.append(f"({q(u)}::uuid, 'family', {q(fam + ' Family')}, {q(liked)})")
    families.append('(' + ', '.join([q(u), q(fam), q(city), q(REGION.get(city, 'ncr')), arr(needs), iarr(kids), q('caregiver' in needs), arr(pets),
                                      arr(langs), q(ARR[arrg]), "'full'", arr(off), q(hours), str(lo), str(hi), arr(extras), q(start), q(bio),
                                      q(origin), str(size), js(notes), q(rule), q(transport)]) + ')')
    check(u, 'phone', checked_on=month(c[0]))
    check(u, 'household_id', id_type='philid', checked_on=month(c[1]), age_ok=True)

new_ids = ', '.join(q(u) + '::uuid' for u, _ in users)
out = []
out.append('-- YayaMatch: 12 more sample yayas and 12 more sample homeowners (Nov 5, 2026). Generated by more_samples.py.')
out.append('-- Insert-only: nothing existing is changed or removed, and accounts already present are skipped.')
out.append('begin;')
out.append("insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, "
           "confirmation_token, recovery_token, email_change_token_new, email_change, email_change_token_current, phone_change, phone_change_token, reauthentication_token) values\n"
           + ',\n'.join(f"  ('00000000-0000-0000-0000-000000000000', {q(u)}, 'authenticated', 'authenticated', {q(e)}, "
                        "extensions.crypt(encode(extensions.gen_random_bytes(24), 'base64'), extensions.gen_salt('bf')), now(), "
                        "'{\"provider\":\"email\",\"providers\":[\"email\"]}', '{}', now(), now(), '', '', '', '', '', '', '', '')" for u, e in users)
           + '\non conflict (id) do nothing;')
out.append(f"insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)\n"
           f"select gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()\n"
           f"from auth.users u where u.id in ({new_ids})\n"
           f"and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');")
out.append("update public.profiles p set side = v.side, display_name = v.name, is_seed = true, seed_likes_new = v.likes, onboarded = true, lang = 'en'\n"
           "from (values\n" + ',\n'.join('  ' + x for x in profiles) + "\n) as v(id, side, name, likes) where p.id = v.id and p.side is null;")
out.append('insert into public.helpers (id, first_name, last_initial, age, city, region, roles, years, skills, cared_for, abroad, languages, rate, arrangement, '
           'days_off, cities, start_in, bio, favorite, photo_path, voice_seconds, voice_script, quotes, experience, gender, years_total, schedule, top_pick) values\n'
           + ',\n'.join('  ' + x for x in helpers) + '\non conflict (id) do nothing;')
out.append('insert into public.families (id, family_name, city, region, needs, kids, elder, pets, languages, arrangement, schedule, rest_days, hours, '
           'budget_min, budget_max, perks, start_date, about, origin, household_size, helper_notes, house_rule, transport) values\n'
           + ',\n'.join('  ' + x for x in families) + '\non conflict (id) do nothing;')
out.append('insert into public.checks (user_id, kind, status, id_type, checked_on, valid_until, age_ok, detail, vendor) values\n'
           + ',\n'.join('  ' + x for x in checks) + '\non conflict (user_id, kind) do nothing;')
out.append('-- the new samples that "like new users" also like the two shared sample sign-ins (Kristine, Santos)\n'
           'insert into public.likes (from_id, to_id)\n'
           'select p.id, d.id from public.profiles p join public.profiles d on d.demo_login and d.side <> p.side\n'
           f'where p.id in ({new_ids}) and p.seed_likes_new on conflict do nothing;')
out.append('commit;')
out.append('select (select count(*) from public.profiles where is_seed and not demo_login) as sample_profiles, '
           "(select count(*) from public.helpers h join public.profiles p on p.id = h.id where p.is_seed and not p.demo_login) as sample_yayas, "
           "(select count(*) from public.families f join public.profiles p on p.id = f.id where p.is_seed and not p.demo_login) as sample_homeowners;")
print('\n\n'.join(out))
