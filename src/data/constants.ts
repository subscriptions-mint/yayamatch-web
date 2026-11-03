// Fixed lists and rules used across both journeys.

export const ROLES = ['nanny', 'housekeeper', 'cook', 'caregiver', 'driver', 'allaround'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_ICON: Record<Role, string> = {
  nanny: 'baby', housekeeper: 'house2', cook: 'chef', caregiver: 'care', driver: 'car', allaround: 'list',
};

export const SKILLS = ['childcare', 'cooking', 'laundry', 'tutoring', 'firstaid', 'petcare', 'driving'] as const;
export type Skill = (typeof SKILLS)[number];
export const SKILL_ICON: Record<Skill, string> = {
  childcare: 'baby', cooking: 'chef', laundry: 'shirt', tutoring: 'book', firstaid: 'aid', petcare: 'paw', driving: 'car',
};

export const CARED_FOR = ['baby', 'toddler', 'elder', 'disability'] as const;
export type CaredFor = (typeof CARED_FOR)[number];

export const LANGS = ['tagalog', 'english', 'bisaya', 'ilocano', 'hiligaynon'] as const;
export type SpokenLang = (typeof LANGS)[number];

export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Day = (typeof DAYS)[number];

export const PERKS = ['ownRoom', 'load', 'fareHome', 'hmo'] as const;
export type Perk = (typeof PERKS)[number];

export const START = ['now', '2weeks', '1month'] as const;
export type StartIn = (typeof START)[number];

export const COUNTRIES = ['hk', 'sg', 'sa', 'ae', 'kw', 'qa', 'tw', 'my'] as const;
export type Country = (typeof COUNTRIES)[number];

export const ID_TYPES = ['philid', 'umid', 'license', 'passport'] as const;
export type IdType = (typeof ID_TYPES)[number];
// Types a live check can come back with (Didit, or an admin review). Shown as "{type} · checked {month}".
export type AnyIdType = IdType | 'postal' | 'prc' | 'sss' | 'voters' | 'other';

export type Region = 'ncr' | 'r7' | 'r11';

export const CITIES = {
  makati: { region: 'ncr', aliases: ['salcedo', 'legaspi', 'rockwell', 'poblacion'] },
  bgc: { region: 'ncr', aliases: ['taguig', 'bgc', 'fort', 'bonifacio', 'mckinley'] },
  qc: { region: 'ncr', aliases: ['quezon', 'qc', 'kyusi', 'diliman', 'cubao'] },
  pasig: { region: 'ncr', aliases: ['ortigas', 'kapitolyo'] },
  manila: { region: 'ncr', aliases: ['maynila', 'malate', 'ermita', 'sampaloc', 'tondo'] },
  mandaluyong: { region: 'ncr', aliases: ['mandaluyong', 'shaw'] },
  sanjuan: { region: 'ncr', aliases: ['greenhills', 'san juan'] },
  pasay: { region: 'ncr', aliases: ['pasay', 'moa'] },
  paranaque: { region: 'ncr', aliases: ['bf homes', 'sucat', 'paranaque'] },
  laspinas: { region: 'ncr', aliases: ['las pinas'] },
  muntinlupa: { region: 'ncr', aliases: ['alabang', 'muntinlupa'] },
  marikina: { region: 'ncr', aliases: ['marikina'] },
  caloocan: { region: 'ncr', aliases: ['caloocan'] },
  valenzuela: { region: 'ncr', aliases: ['valenzuela'] },
  malabon: { region: 'ncr', aliases: ['malabon'] },
  navotas: { region: 'ncr', aliases: ['navotas'] },
  pateros: { region: 'ncr', aliases: ['pateros'] },
  cebu: { region: 'r7', aliases: ['cebu', 'lahug', 'mabolo', 'it park'] },
  davao: { region: 'r11', aliases: ['davao', 'lanang', 'matina'] },
} as const satisfies Record<string, { region: Region; aliases: readonly string[] }>;
export type City = keyof typeof CITIES;
export const CITY_KEYS = Object.keys(CITIES) as City[];
export const POPULAR_CITIES: City[] = ['makati', 'bgc', 'qc', 'pasig', 'manila', 'mandaluyong', 'cebu', 'davao'];

// Kasambahay monthly minimum wage by region (wage orders in force, Nov 2026).
export const MIN_WAGE: Record<Region, { amount: number; since: string; order: string }> = {
  ncr: { amount: 7800, since: '2026-02-07', order: 'NCR-DW-06' },
  r7: { amount: 7500, since: '2026-10-14', order: 'ROVII-DW-06' },
  r11: { amount: 6500, since: '2026-03-13', order: 'RB XI' },
};
export const regionOf = (c: City): Region => CITIES[c].region;
export const minWageFor = (c: City) => MIN_WAGE[regionOf(c)];

export const RATE_MAX = 30000;
export const RATE_STEP = 500;
export const MIN_HELPER_AGE = 18;
export const WORK_START_AGE = 15;

// Families pay; helpers never do.
export const PRICES = { chat_unlock: 79, pass: 199, premium: 399, report: 99, urgent: 199 } as const;
export type Product = keyof typeof PRICES;
export const DURATIONS_H: Partial<Record<Product, number>> = { pass: 24 * 7, premium: 24 * 30, urgent: 72 };
export const FREE_LIKES_PER_DAY = 10;
export const FREE_OPEN_CHATS = 3;
export const QR_TTL_SEC = 15 * 60;
export const DEMO_OTP = '123456';
export const AVAILABLE_HOURS = 24;
export const PLAN_HOW = ['messenger', 'viber', 'phone', 'in_person'] as const;
