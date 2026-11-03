// Minimal Phoenix (Supabase Realtime) client: one socket, one postgres_changes subscription at a time.
// Chat never depends on it: the sync layer also polls, so a blocked or failing socket only costs a few seconds.
import { getSession, realtimeUrl } from './client';

type Handler = (record: Record<string, unknown>) => void;

let ws: WebSocket | null = null;
let ref = 0;
let heartbeat: number | null = null;
let retryTimer: number | null = null;
let failures = 0;
let wanted: { topic: string; matchId: string; onInsert: Handler } | null = null;
let joined = false;

const nextRef = () => String(++ref);

function send(msg: unknown) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function join() {
  if (!wanted || !ws || ws.readyState !== WebSocket.OPEN) return;
  const s = getSession();
  send({
    topic: wanted.topic, event: 'phx_join', ref: nextRef(),
    payload: {
      config: { postgres_changes: [{ event: 'INSERT', schema: 'public', table: 'messages', filter: `match_id=eq.${wanted.matchId}` }] },
      access_token: s?.access_token,
    },
  });
  joined = true;
}

function connect() {
  if (ws || typeof WebSocket === 'undefined') return;
  if (failures >= 6) return; // give up quietly; polling keeps chat working
  try {
    ws = new WebSocket(realtimeUrl());
  } catch {
    ws = null; failures++; return;
  }
  ws.onopen = () => {
    failures = 0;
    heartbeat = window.setInterval(() => send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: nextRef() }), 25000);
    join();
  };
  ws.onmessage = ev => {
    let msg: { event?: string; topic?: string; payload?: Record<string, any> };
    try { msg = JSON.parse(String(ev.data)); } catch { return; }
    if (msg.event !== 'postgres_changes' || !wanted || msg.topic !== wanted.topic) return;
    const rec = msg.payload?.data?.record ?? msg.payload?.record;
    if (rec && typeof rec === 'object') wanted.onInsert(rec as Record<string, unknown>);
  };
  ws.onclose = () => {
    if (heartbeat) window.clearInterval(heartbeat);
    heartbeat = null; ws = null; joined = false;
    if (!wanted) return;
    failures++;
    if (retryTimer) window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(connect, Math.min(30000, 1000 * 2 ** failures));
  };
  ws.onerror = () => { /* onclose follows */ };
}

/** Listen for new messages in one match. Returns a function that stops listening. */
export function subscribeMessages(matchId: string, onInsert: Handler): () => void {
  if (wanted && joined) send({ topic: wanted.topic, event: 'phx_leave', payload: {}, ref: nextRef() });
  wanted = { topic: 'realtime:public:messages', matchId, onInsert };
  if (ws && ws.readyState === WebSocket.OPEN) join(); else connect();
  return () => {
    if (wanted?.matchId !== matchId) return;
    if (joined) send({ topic: wanted.topic, event: 'phx_leave', payload: {}, ref: nextRef() });
    wanted = null; joined = false;
  };
}

/** Pass a refreshed token to the open channel. */
export function updateRealtimeToken(token: string) {
  if (wanted && joined) send({ topic: wanted.topic, event: 'access_token', payload: { access_token: token }, ref: nextRef() });
}

export function closeRealtime() {
  wanted = null; joined = false;
  if (retryTimer) window.clearTimeout(retryTimer);
  try { ws?.close(); } catch { /* ignore */ }
  ws = null;
}
