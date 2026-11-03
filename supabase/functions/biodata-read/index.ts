// Reads a photo of a paper biodata and returns suggested profile answers. The yaya reviews every field before saving.
// The image is sent to the model and not stored anywhere by YayaMatch.
import { cors, getUser, json } from '../_shared/util.ts';

const ROLES = ['nanny', 'housekeeper', 'cook', 'caregiver', 'driver', 'allaround'];
const SKILLS = ['childcare', 'cooking', 'laundry', 'tutoring', 'firstaid', 'petcare', 'driving'];
const LANGS = ['tagalog', 'english', 'bisaya', 'ilocano', 'hiligaynon'];
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const SAMPLE = {
  full_name: 'Kristine Villanueva', age: 27, city: 'Quezon City', roles: ['nanny', 'housekeeper'], years: { nanny: 5, housekeeper: 2 },
  skills: ['childcare', 'cooking', 'laundry', 'tutoring'], languages: ['tagalog', 'english'], rate: 12000, arrangement: 'live-out', days_off: ['sat', 'sun'],
};

const PROMPT = `This is a photo of a Filipino domestic worker's biodata form. Read it and reply with ONLY a JSON object, no other text:
{"full_name": string|null, "age": number|null, "city": string|null,
 "roles": subset of ${JSON.stringify(ROLES)}, "years": {role: years of experience as number},
 "skills": subset of ${JSON.stringify(SKILLS)}, "languages": subset of ${JSON.stringify(LANGS)},
 "rate": expected monthly salary in pesos as number|null, "arrangement": "live-in"|"live-out"|null,
 "days_off": subset of ${JSON.stringify(DAYS)}}
Use null or [] when something is not on the form. Do not guess. Do not include ID numbers, addresses, religion, civil status or health details.`;

function clean(f: any) {
  const pick = (a: unknown, allowed: string[]) => (Array.isArray(a) ? a.filter((x) => allowed.includes(x)) : []);
  const num = (n: unknown, lo: number, hi: number) => (typeof n === 'number' && n >= lo && n <= hi ? Math.round(n) : null);
  const years: Record<string, number> = {};
  if (f?.years && typeof f.years === 'object') for (const [k, v] of Object.entries(f.years)) if (ROLES.includes(k) && typeof v === 'number') years[k] = Math.max(0, Math.min(50, Math.round(v)));
  return {
    full_name: typeof f?.full_name === 'string' ? f.full_name.slice(0, 80) : null,
    age: num(f?.age, 15, 80),
    city: typeof f?.city === 'string' ? f.city.slice(0, 60) : null,
    roles: pick(f?.roles, ROLES), years, skills: pick(f?.skills, SKILLS), languages: pick(f?.languages, LANGS),
    rate: num(f?.rate, 1000, 100000),
    arrangement: f?.arrangement === 'live-in' || f?.arrangement === 'live-out' ? f.arrangement : null,
    days_off: pick(f?.days_off, DAYS),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'not signed in' }, 401);
    const { image_base64, media_type } = await req.json().catch(() => ({}));
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ mode: 'test', fields: SAMPLE });
    if (typeof image_base64 !== 'string' || image_base64.length > 7_000_000) return json({ error: 'image missing or too large' }, 400);
    const mt = ['image/jpeg', 'image/png', 'image/webp'].includes(media_type) ? media_type : 'image/jpeg';
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('BIODATA_MODEL') ?? 'claude-haiku-5-5',
        max_tokens: 800,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mt, data: image_base64 } },
          { type: 'text', text: PROMPT },
        ] }],
      }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: 'could not read the biodata' }, 502);
    const text: string = out?.content?.find((c: any) => c.type === 'text')?.text ?? '';
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    let fields = {};
    try { fields = clean(JSON.parse(text.slice(start, end + 1))); } catch { return json({ error: 'could not read the biodata' }, 422); }
    return json({ mode: 'live', fields });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
