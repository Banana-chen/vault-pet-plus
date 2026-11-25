'use strict';
/*
 * [Plus] 고양이 모으기: 고양이마다 따로 자라기 · 만남 · 길들이기. 상태를 받아 새 상태를 돌려준다 (고치지 않는다).
 *
 * 경험치: 볼트 전체 경험치(raw)는 하나다. 고양이마다 '쉬기 시작할 때 모아 둔 것(frozen)'과 '데려온 순간의 raw(base)'를 적어 두고
 *   데려온 고양이 = frozen + (raw - base), 쉬는 고양이 = frozen. 처음 고양이(치즈)는 0 · 0 이라 지금 경험치 그대로다.
 * 글자 수도 같은 식이다 (cFrozen · cBase).
 *
 * 만남 조건 · 확률은 사용자에게 보여 주지 않는다 (새로움). 여기 숫자를 바꿔도 이미 생긴 표는 그대로다.
 */
const { BREEDS, START_BREED, breedOf } = require('./breeds');

// 이 조건을 처음 넘으면 만남 표가 하나 생긴다 (한 번씩만)
const TRIGGERS = [
  ['chars10k', (m) => m.chars >= 10_000],
  ['chars40k', (m) => m.chars >= 40_000],
  ['chars60k', (m) => m.chars >= 60_000],
  ['chars100k', (m) => m.chars >= 100_000],
  ['chars250k', (m) => m.chars >= 250_000],
  ['correct10', (m) => m.correct >= 10],
  ['correct40', (m) => m.correct >= 40],
  ['correct120', (m) => m.correct >= 120],
  ['streak3', (m) => m.streak >= 3],
  ['streak7', (m) => m.streak >= 7],
  ['streak14', (m) => m.streak >= 14],
  ['streak21', (m) => m.streak >= 21],
  ['links5', (m) => m.links >= 5],
  ['links20', (m) => m.links >= 20],
  ['links60', (m) => m.links >= 60],
  ['tidy3', (m) => m.tidy >= 3],
  ['tidy8', (m) => m.tidy >= 8],
  ['tidy15', (m) => m.tidy >= 15],
  ['night', (m) => m.night],
  ['dawn', (m) => m.dawn],
  ['focus3', (m) => m.focusTotal >= 3],
  ['focus10', (m) => m.focusTotal >= 10],
  ['weekend', (m) => m.weekend],
  ['notes3', (m) => m.notesToday >= 3],
  ['notes5', (m) => m.notesToday >= 5],
  ['allClear', (m) => m.allClear],
];
const TRIGGER_CHANCE = 0.6; // 조건을 넘었을 때 만남 표가 생길 확률
const TICKET_DELAY_DAYS = 3; // 표가 생기고 0~3일 안에 만난다
const DAILY_CHANCE = 0.03; // 아무 조건 없이 하루 한 번 굴려 표가 생길 확률
const RARE_AFTER = 3; // 이만큼 모은 뒤에야 귀한 품종이 나온다
const RARE_WEIGHT = 0.25;
const MEET_WEIGHT = 6; // 만남 표를 만든 조건이 그 품종의 meet 에 있으면 이만큼 더 잘 나온다
const STRAY_MS = 15 * 60_000;
const isNight = (h) => h >= 22 || h < 2;
const isDawn = (h) => h >= 5 && h < 9;
const KEEP_DAYS = 400; // 날 기록은 이만큼만 (밤 · 쓴 날 세기용)

function seed({ correct = 0 } = {}, now = 0) {
  return {
    active: START_BREED,
    cats: { [START_BREED]: newCat(START_BREED, { raw: 0, chars: 0, now }, correct) },
    seen: { [START_BREED]: now },
    flags: {},
    tickets: [],
    rolled: 0,
    stray: null,
    bigBase: null, // 처음 볼 때 이미 있던 긴 노트 수 (그 뒤에 새로 생긴 것만 조건)
  };
}

const has = (s, key) => typeof key === 'string' && Object.prototype.hasOwnProperty.call(s.cats, key);

function newCat(breed, { raw, chars, now }, correct = 0) {
  // lastLevel · lastStage 는 쉬는 동안 화면이 기억할 자리 (바꿀 때 host 가 채운다)
  // peak = 이 고양이가 올라간 가장 높은 단계 (링크를 지워도 퇴화하지 않는 바닥, 고양이마다)
  return { breed, at: now, frozen: 0, base: raw, cFrozen: 0, cBase: chars, correct, days: [], nights: [], dawns: [], focus: 0, name: null, look: null, lastLevel: null, lastStage: null, peak: 0 };
}

const caught = (s) => Object.keys(s.cats);

// 고양이 한 마리를 읽을 때 옛 저장에 없는 습관 칸은 빈 값으로 본다 (저장에는 쓰지 않는다).
// 습관을 읽는 곳은 다 catOf 를 거치고, 습관 칸을 새로 만들면 여기 한 줄만 더하면 된다 (합치기 mergeCatHabits 도 이걸 본다)
const HABIT_DEFAULTS = { correct: 0, focus: 0, peak: 0, days: [], nights: [], dawns: [] };
const catOf = (s, key) => ({ ...HABIT_DEFAULTS, ...s.cats[key] });

// raw 에 더하면 데려온 고양이의 경험치가 되는 값
const xpAdjust = (s) => s.cats[s.active].frozen - s.cats[s.active].base;

const catXp = (s, key, raw) => {
  const c = s.cats[key];
  return key === s.active ? c.frozen + raw - c.base : c.frozen;
};

const catChars = (s, key, chars) => {
  const c = s.cats[key];
  return key === s.active ? c.cFrozen + chars - c.cBase : c.cFrozen;
};

const setCat = (s, key, patch) => ({ ...s, cats: { ...s.cats, [key]: { ...s.cats[key], ...patch } } });

// 데려온 고양이를 바꾼다. 지금 고양이는 여기까지 모아 두고, 새 고양이는 지금부터 센다
// (폴더를 빼면 raw 가 줄 수 있으니 0 아래로는 안 간다)
function switchTo(s, key, { raw, chars }) {
  if (!has(s, key) || key === s.active) return s;
  const cur = s.cats[s.active];
  const out = setCat(s, s.active, { frozen: Math.max(0, cur.frozen + raw - cur.base), cFrozen: Math.max(0, cur.cFrozen + chars - cur.cBase) });
  return { ...setCat(out, key, { base: raw, cBase: chars }), active: key };
}

function adopt(s, key, at) {
  if (has(s, key) || !breedOf(key)) return s;
  return { ...s, cats: { ...s.cats, [key]: newCat(key, at) }, seen: { ...s.seen, [key]: s.seen[key] || at.now } };
}

// 데려온 고양이의 세는 습관 하나를 올린다
const countHabit = (s, k) => setCat(s, s.active, { [k]: catOf(s, s.active)[k] + 1 });
const addCorrect = (s) => countHabit(s, 'correct');
const addFocus = (s) => countHabit(s, 'focus');

// 데려온 고양이가 이날 썼다 (hour 는 현지 시각). 밤(22~2시)이면 밤으로도, 아침(5~9시)이면 아침으로도 센다
function recordActivity(s, day, hour) {
  const c = catOf(s, s.active);
  const add = (list) => (list.includes(day) ? list : [...list, day].slice(-KEEP_DAYS));
  // 그 시간이 아니면 그 목록은 건드리지 않는다 (옛 저장에 빈 목록을 새로 쓰지 않게)
  return setCat(s, s.active, { days: add(c.days), ...(isNight(hour) && { nights: add(c.nights) }), ...(isDawn(hour) && { dawns: add(c.dawns) }) });
}

const peakOf = (s) => catOf(s, s.active).peak;
const notePeak = (s, stage) => (stage > peakOf(s) ? setCat(s, s.active, { peak: stage }) : s);

function habitsOf(s, key, { chars, links }) {
  const c = catOf(s, key);
  return { chars: Math.max(0, catChars(s, key, chars)), correct: c.correct, links, nights: c.nights.length, days: c.days.length, dawns: c.dawns.length, focus: c.focus };
}

// 두 기기에서 같은 고양이가 자랐다 (plugin/sync.js). 습관 칸마다: 센 것(숫자)은 큰 쪽, 날 목록은 합집합.
// 더하지 않는다: 같은 파일을 두 번 합치거나 기준이 오래되면 두 번 센다. 큰 쪽은 몇 번 합쳐도 같다
// (대신 두 기기에서 한 고양이를 동시에 키우면 그동안 한쪽 몫은 잃는다). 양쪽 다 없는 칸은 만들지 않는다.
// 나머지(경험치 기준점 · 생김새 · 이름)는 이 기기 것
function mergeCatHabits(mine, theirs) {
  const merged = Object.keys(HABIT_DEFAULTS)
    .filter((k) => k in mine || k in theirs)
    .map((k) => {
      const a = mine[k] ?? HABIT_DEFAULTS[k], b = theirs[k] ?? HABIT_DEFAULTS[k];
      return [k, Array.isArray(a) ? [...new Set([...a, ...b])].sort((x, y) => x - y).slice(-KEEP_DAYS) : Math.max(a, b)];
    });
  return { ...mine, ...Object.fromEntries(merged) };
}

/* ── 만남 ── */

// metrics: { chars, correct, links, tidy, streak, night, weekend, notesToday, bigNotes, allClear }
// 조건마다 한 번만. 넘었을 때 TRIGGER_CHANCE 확률로 며칠 안에 만날 표가 생긴다
function checkTriggers(s, metrics, today, rand = Math.random) {
  const bigBase = s.bigBase == null ? metrics.bigNotes : s.bigBase;
  const m = { ...metrics, bigNote: metrics.bigNotes > bigBase };
  const fired = [...TRIGGERS, ['bigNote', (x) => x.bigNote]].filter(([id, test]) => !s.flags[id] && test(m)).map(([id]) => id);
  if (!fired.length) return { state: s.bigBase == null ? { ...s, bigBase } : s, fired };
  const flags = { ...s.flags, ...Object.fromEntries(fired.map((id) => [id, today])) };
  const won = fired.filter(() => rand() < TRIGGER_CHANCE);
  const tickets = [...s.tickets, ...won.map((why) => ({ why, due: today + Math.floor(rand() * (TICKET_DELAY_DAYS + 1)) }))];
  return { state: { ...s, flags, tickets, bigBase }, fired };
}

function rollDaily(s, today, rand = Math.random) {
  if (s.rolled === today) return s;
  const hit = rand() < DAILY_CHANCE;
  return { ...s, rolled: today, tickets: hit ? [...s.tickets, { why: 'luck', due: today }] : s.tickets };
}

const ticketDue = (s, today) => s.tickets.some((t) => t.due <= today);

// 아직 안 데려온 품종 하나 (귀한 품종은 RARE_AFTER 마리 모은 뒤로, 덜 나온다). 다 모았으면 null
// today 를 주면 오늘 쓸 표(가장 먼저 만기된 것)의 조건을 보고 그 조건을 좋아하는 품종(meet)을 더 자주 고른다
function pickBreed(s, rand = Math.random, today = null) {
  const rareOk = caught(s).length >= RARE_AFTER;
  const pool = BREEDS.filter((b) => !s.cats[b.key] && b.rarity !== 'start' && (b.rarity !== 'rare' || rareOk));
  if (!pool.length) return null;
  const ticket = today == null ? null : s.tickets.find((t) => t.due <= today);
  const w = (b) => (b.rarity === 'rare' ? RARE_WEIGHT : 1) * (ticket && (b.meet || []).includes(ticket.why) ? MEET_WEIGHT : 1);
  let r = rand() * pool.reduce((n, b) => n + w(b), 0);
  for (const b of pool) if ((r -= w(b)) < 0) return b.key;
  return pool[pool.length - 1].key;
}

function startStray(s, breed, today, now) {
  const i = s.tickets.findIndex((t) => t.due <= today);
  const tickets = i < 0 ? s.tickets : s.tickets.filter((_, j) => j !== i);
  return { ...s, tickets, seen: { ...s.seen, [breed]: s.seen[breed] || now }, stray: { breed, at: now, until: now + STRAY_MS } };
}

const strayHere = (s, now) => !!s.stray && now < s.stray.until;
const endStray = (s) => ({ ...s, stray: null });

/* ── 길들이기 ── */

// 먹이 값(비쌀수록 조금씩) + 맞힌 문제마다 + 귀한 품종은 어렵다. 5% ~ 90%
function tameChance({ correct, price, rarity }) {
  const food = Math.min(0.3, 0.06 * Math.log2(Math.max(0, price) / 5 + 1));
  const p = 0.15 + food + 0.15 * correct - (rarity === 'rare' ? 0.2 : 0);
  return Math.max(0.05, Math.min(0.9, p));
}

module.exports = {
  STRAY_MS,
  isNight, isDawn, has,
  seed, caught, xpAdjust, catXp, catChars, switchTo, adopt, addCorrect, addFocus, recordActivity, habitsOf, catOf, mergeCatHabits, setCat, peakOf, notePeak,
  checkTriggers, rollDaily, ticketDue, pickBreed, startStray, strayHere, endStray, tameChance,
};
