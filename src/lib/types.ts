import type { Role, Skill, SpokenLang, City, Day, StartIn, AnyIdType, Perk, CaredFor, Country, Product } from '../data/constants';

export type Lang = 'en' | 'tl';
export type Side = 'family' | 'yaya';
export type Arrangement = 'livein' | 'liveout';
export type Ym = string; // 'YYYY-MM'

export interface Quote { text: string; who: string }

export interface Helper {
  id: string;
  firstName: string;
  lastInitial: string;
  gender: 'f' | 'm' | 'x'; // 'x': not given (live cards without a gender)
  age: number;
  roles: Role[];
  years: number;
  city: City;
  rate: number;
  arrangement: Arrangement;
  languages: SpokenLang[];
  bio: string;
  skills: Skill[];
  experience: { years: string; text: string }[];
  schedule: string;
  startIn: StartIn;
  daysOff: Day[];
  checks: { phone?: Ym; id?: { type: AnyIdType; month: Ym }; nbi?: Ym; refs?: { n: number; month: Ym }; tesda?: string; medical?: Ym };
  quotes: Quote[];
  photo: string;
  likedYou: boolean;
  topPick: boolean;
  voice: { sec: number; script: string; url?: string };
  favorite: string;
  sample?: boolean; // live: one of the sample profiles (tagged "Sample profile")
}

export interface Household {
  id: string;
  name: string;
  initials: string;
  origin: 'filipino' | 'ofw' | 'expat' | null;
  city: City;
  size: number | null;
  kidsAges: number[];
  pets: string[];
  needs: Role[];
  rateMin: number;
  rateMax: number;
  arrangement: Arrangement;
  hours: string | null;
  daysOff: Day[];
  startDate: string | null;
  bio: string;
  houseRule: string;
  languages: SpokenLang[];
  checks: { phone?: Ym; id?: Ym };
  extras: Perk[];
  notes: Quote[];
  likedYou: boolean;
  transport?: boolean;
  sample?: boolean; // live: one of the sample profiles
}

// 'call' is kept so older saved demo chats still render (shown like a plan).
export type MsgKind = 'text' | 'system' | 'number' | 'plan' | 'call' | 'hired' | 'opener-used' | 'capped';
export type PlanHow = 'messenger' | 'viber' | 'phone' | 'in_person';
export interface Message {
  id: string;
  from: 'me' | 'them' | 'system';
  text: string;
  at: number;
  kind?: MsgKind;
  meta?: Record<string, string | number | boolean>;
}
export interface Chat {
  id: string; // other party id
  matchId?: string; // live: matches.id
  matchedAt: number;
  messages: Message[];
  openerUsed: boolean;
  unread: number;
  typing: boolean;
  theyShared: boolean;
  iShared: boolean;
  callAt: number | null; // time of the latest planned call or meeting
  replies: number; // scripted replies sent by the other side
  hired: boolean;
}

export interface Purchase { id: string; item: Product; amount: number; method: string; at: number; ref: string; target?: string }

export interface FamilyState {
  phone: string;
  verified: boolean;
  onboarded: boolean;
  name: string;
  roles: Role[];
  city: City;
  kids: number[];
  elder: boolean;
  pets: string[];
  langs: SpokenLang[];
  arrangement: Arrangement;
  schedule: 'fulltime' | 'parttime';
  restDays: Day[];
  budgetMin: number;
  budgetMax: number;
  perks: Perk[];
  likes: string[];
  passes: string[];
  likeDay: string;
  likesUsedToday: number;
  matches: string[];
  chats: Record<string, Chat>;
  passUntil: number | null;
  premiumUntil: number | null;
  urgentUntil: number | null;
  unlocked: string[];
  reports: string[];
  blocked: string[];
  reported: string[];
  filters: { idOnly: boolean; liveInOnly: boolean; maxRate: number | null; lang: SpokenLang | null; minYears: number };
  roleFilter: Role | 'all';
  hires: { helperId: string; at: number; checklist: Record<string, boolean> }[];
  purchases: Purchase[];
  seenMatches: string[];
  idCheck: { type: AnyIdType; month: Ym } | null; // household ID check, required before the first message
}

export interface YayaState {
  phone: string;
  verified: boolean;
  onboarded: boolean;
  fromBiodata: boolean;
  name: string;
  age: number;
  homeCity: City | null;
  roles: Role[];
  yearsByRole: Partial<Record<Role, number>>;
  skills: Skill[];
  caredFor: CaredFor[];
  abroad: boolean;
  countries: Country[];
  langs: SpokenLang[];
  rate: number;
  arrangement: Arrangement;
  daysOff: Day[];
  workCities: City[];
  startIn: StartIn;
  photo: string | null; // asset name, data URL or (live) public storage URL
  lastInitial: string;
  phoneShare: string; // live: private number used only for share-number (profiles.phone)
  voiceSec: number | null;
  bio: string;
  idCheck: { type: AnyIdType; month: Ym } | null;
  voiceUrl: string | null; // live: public URL of the uploaded voice intro
  nbi: boolean;
  availableUntil: number | null;
  interested: string[];
  hidden: string[];
  matches: string[];
  chats: Record<string, Chat>;
  blocked: string[];
  reported: string[];
  hired: { householdId: string; at: number; confirmed: boolean } | null;
  visible: boolean;
  seenMatches: string[];
}

export type CheckStatus = 'none' | 'pending' | 'passed' | 'failed' | 'review';

// Live mode only: who is signed in and the cards they can see. The demo never sets it.
export interface LiveState {
  status: 'boot' | 'out' | 'in';
  loaded: boolean; // first load of the signed-in user's data finished
  uid: string | null;
  email: string | null;
  role: 'user' | 'admin';
  side: Side | null;
  onboarded: boolean;
  demoLogin: boolean; // one of the shared sample sign-ins
  helpers: Record<string, Helper>;
  households: Record<string, Household>;
  likedMe: string[]; // who liked me (families only see this with a pass)
  likedCount: number; // families without a pass: how many liked them (rpc likes_received_count, 0003), else 0
  matchOf: Record<string, string>; // other party id -> match id
  hireOf: Record<string, string>; // other party id -> hire id
  idStatus: CheckStatus; // my own ID / household ID check
  samples: string[]; // ids of the sample profiles (rpc sample_ids)
}

export interface AppState {
  v: 1;
  lang: Lang;
  langChosen: boolean;
  family: FamilyState;
  yaya: YayaState;
  live?: LiveState;
}

// Results the screens react to. Live mode adds the server's answers ('needs_id', 'blocked', 'error').
export type LikeResult = 'limit' | 'match' | 'liked' | 'error';
export type InterestResult = 'match' | 'sent' | 'error';
export type SendResult = 'ok' | 'locked' | 'capped' | 'empty' | 'needs_id' | 'blocked' | 'denied' | 'error';
export interface PlanInput { at: number; how: PlanHow; note: string }
