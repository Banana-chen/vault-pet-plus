'use strict';
// [Plus] 복습 카드: 노트 제목이 정답, 첫 단락이 문제 (고양이가 제목 글자를 먹어 버렸다).
// 형광펜(==말==) 카드도 있다: 그 말이 있는 단락에서 그 말을 먹었다.
// 카드 내용은 따로 저장하지 않는다. 문제는 낼 때마다 지금 노트에서 만들고, 저장하는 건 상자 번호와 다음 날짜뿐이다.

const BLANK = '＿＿';
// 상자 0~4 의 간격 (일). 맞히면 다음 상자, 틀리면 상자 0
const BOX_DAYS = [1, 2, 4, 8, 16];
const DAILY_CAP = 10;
const REVIEW_XP = 15;
const QUESTION_MAX = 300;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 'CDP(Chrome DevTools Protocol)' → [전체, 'CDP', 'Chrome DevTools Protocol']. 괄호는 전각도 받는다.
// 괄호가 가운데 있으면 ('共變數(Covariates)陷阱') 괄호 밖을 이은 이름 · 괄호 안 · 괄호 앞 이름
// 괄호만 보는 이름들. 링크 정리(tidy)는 이것만 쓴다 — 나뉜 제목의 한쪽('Kafka')마다 링크를 권하면 안 되니까
function namesOf(title) {
  const t = String(title).trim();
  const m = t.match(/^(.+?)\s*[(（]([^()（）]+)[)）]\s*(.*)$/);
  const list = m ? [t, (m[1] + m[3]).trim(), m[2].trim(), m[3] ? m[1].trim() : ''] : [t];
  return [...new Set(list.filter(Boolean))];
}

// '非同步處理的消費模式：Push vs. Pull' · 'DDD-Single source of truth' → [앞, 뒤].
// 시각('10:30')과 붙임표 합성어('e-mail' · 'UTF-8' · 'API-first')는 나누지 않는다: 붙임표는 '약어-대문자로 시작하는 말'만
function partsOf(title) {
  const t = String(title).trim();
  const m = t.match(/^(.+?)\s*(?:[：—–]|(?<!\d):(?!\d)|\s-\s)\s*(.+)$/) || t.match(/^([A-Z0-9]{2,6})-([A-Z][a-z].*)$/);
  return m ? [m[1].trim(), m[2].trim()] : null;
}

// 세 글자 이하 영문 약어 앞 이름은 분류일 뿐이라 ('DDD') 정답이 아니라 close 로 받는다 (中文 세 글자는 온전한 이름)
const isLoose = (part) => /^[A-Za-z0-9]{1,3}$/.test(part);
const looseOf = (title) => (partsOf(title) || []).filter(isLoose);

// 복습 정답: 괄호 이름들 + 나뉜 제목의 앞 · 뒤 (각각 괄호 규칙도 그대로)
function answersOf(title) {
  const t = String(title).trim();
  const parts = partsOf(t);
  if (!parts) return namesOf(t);
  return [...new Set([t, ...parts.filter((p) => !isLoose(p)).flatMap(namesOf)])];
}

// 첫 단락: frontmatter 와 앞쪽 제목줄 · 빈 줄을 건너뛰고 다음 빈 줄까지
function firstParagraph(text) {
  const body = String(text).replace(/^---\n[\s\S]*?\n---\n?/, '');
  const out = [];
  for (const line of body.split('\n')) {
    const s = line.trim();
    if (!out.length && (!s || s.startsWith('#'))) continue;
    if (!s) break;
    out.push(s);
  }
  return out.join('\n').slice(0, QUESTION_MAX);
}

// 문제에서 가릴 말: 정답들과, 中文 쪽 이름 안의 영어 낱말 ('Juggler協定' 의 'Juggler'),
// 여러 낱말 영어 이름의 머리글자 ('Dead Letter Queue' 의 'DLQ')
const initialsOf = (answers) =>
  answers
    .filter((a) => /^[A-Za-z][A-Za-z ]+$/.test(a) && a.trim().split(/\s+/).length >= 2)
    .map((a) => a.trim().split(/\s+/).map((w) => w[0].toUpperCase()).join(''))
    .filter((x) => x.length >= 3);

// 나뉜 제목은 앞 · 뒤 안의 대문자로 시작하는 영어 낱말도 가린다 ('Push vs. Pull' 의 'Push' · 'Pull').
// 소문자 보통 낱말('source' · 'truth')은 본문 여기저기를 다 지워 버리니 둔다
function maskTerms(title, answers, loose) {
  const parts = partsOf(title);
  const latin = parts
    ? parts.flatMap((s) => s.match(/\b[A-Z][A-Za-z0-9]{2,}/g) || [])
    : (answers[1] || '').match(/[A-Za-z][A-Za-z0-9]{2,}/g) || [];
  return [...new Set([...answers, ...loose, ...latin])].sort((a, b) => b.length - a.length);
}

const normalize = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

// 정답에는 머리글자도 넣는다 (DLQ 로 답해도 맞다). 머리글자는 문제에서도 가려진다
function cardOf(title, text) {
  const named = answersOf(title);
  const answers = [...new Set([...named, ...initialsOf(named)])];
  const loose = looseOf(title);
  // 영어로 시작 · 끝나는 말은 낱말 안쪽(safe 속 'fe')을 가리지 않게 경계를 본다.
  // 한 번에 훑어서(긴 말 먼저) 빈칸마다 먹힌 글자(bites)를 순서대로 남긴다
  const edge = (term) => `${/^[A-Za-z0-9]/.test(term) ? '(?<![A-Za-z0-9])' : ''}${escapeRe(term)}${/[A-Za-z0-9]$/.test(term) ? '(?![A-Za-z0-9])' : ''}`;
  const bites = [];
  const eat = new RegExp(maskTerms(title, answers, loose).map(edge).join('|'), 'gi');
  const question = firstParagraph(text).replace(eat, (m) => (bites.push(m), BLANK));
  if (normalize(question.split(BLANK).join('')).length < 4) return null;
  return { kind: 'title', answers, loose, question, bites };
}

/* ── 형광펜 카드 ── */

// 덱 열쇠: 제목 카드는 노트 경로, 형광펜 카드는 '경로\n==말'
const HL_SEP = '\n==';
const HIGHLIGHT = /==([^=\n]+)==/g;
const stripCode = (text) => String(text).replace(/```[\s\S]*?(```|$)/g, '').replace(/`[^`\n]*`/g, '');

function highlightsOf(text) {
  return [...new Set([...stripCode(text).matchAll(HIGHLIGHT)].map((m) => m[1].trim()).filter(Boolean))];
}

const cardKeys = (path, text) => [path, ...highlightsOf(text).map((h) => path + HL_SEP + h)];

function parseKey(key) {
  const i = key.indexOf(HL_SEP);
  return i < 0 ? { path: key, highlight: null } : { path: key.slice(0, i), highlight: key.slice(i + HL_SEP.length) };
}

function clozeOf(text, highlight) {
  const para = stripCode(text)
    .split(/\n\s*\n/)
    .find((p) => p.includes(`==${highlight}==`));
  if (!para) return null;
  const question = para
    .trim()
    .split(`==${highlight}==`)
    .join(BLANK)
    .replace(HIGHLIGHT, '$1')
    .slice(0, QUESTION_MAX);
  return { answers: [highlight], question, bites: Array(question.split(BLANK).length - 1).fill(highlight) };
}

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// 'right' | 'close' | 'wrong'. close 는 맞았는지 본인이 고른다 (오타 · 簡繁 차이 · 분류 이름만 댄 답)
function grade(input, answers, loose = []) {
  const n = normalize(input);
  if (!n) return 'wrong';
  const keys = answers.map(normalize).filter(Boolean);
  if (keys.includes(n)) return 'right';
  if (loose.map(normalize).includes(n)) return 'close';
  const close = keys.some((k) => k.length >= 3 && distance(n, k) <= Math.max(1, Math.floor(k.length * 0.4)));
  return close ? 'close' : 'wrong';
}

// card = { b: 상자, due: 다음 날 (dayNum) }. 힌트를 쓰고 맞히면 상자는 그대로
function schedule(card, result, today, hinted) {
  if (result !== 'right') return { b: 0, due: today + BOX_DAYS[0] };
  const b = hinted ? card.b : Math.min(card.b + 1, BOX_DAYS.length - 1);
  return { b, due: today + BOX_DAYS[b] };
}

// 지금 노트 목록에 맞춘 새 덱. 처음엔 전부 오늘부터, 그 뒤에 생긴 노트는 내일부터
function syncDeck(deck, paths, today, first) {
  const out = {};
  for (const p of paths) out[p] = deck[p] || { b: 0, due: first ? today : today + 1 };
  return out;
}

// 노트 · 폴더 이름이 바뀌면 그 아래 제목 카드 · 형광펜 카드를 다 옮긴다
function renameInDeck(deck, from, to) {
  const moved = (path) => (path === from ? to : path.startsWith(from + '/') ? to + path.slice(from.length) : null);
  return Object.fromEntries(
    Object.entries(deck).map(([k, c]) => {
      const { path, highlight } = parseKey(k);
      const p = moved(path);
      return [p === null ? k : highlight === null ? p : p + HL_SEP + highlight, c];
    }),
  );
}

// 오늘 낼 카드: 오래 밀린 것부터, 하루 DAILY_CAP 장까지
function dueToday(deck, today, doneToday, cap = DAILY_CAP) {
  return Object.entries(deck)
    .filter(([, c]) => c.due <= today)
    .sort((a, b) => a[1].due - b[1].due || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, cap - doneToday))
    .map(([p]) => p);
}

const xpFor = (result, hinted) => (result === 'right' ? (hinted ? Math.floor(REVIEW_XP / 2) : REVIEW_XP) : 0);

// 현지 시각 기준 날짜 번호
const dayNum = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);

module.exports = { BLANK, BOX_DAYS, DAILY_CAP, REVIEW_XP, answersOf, namesOf, looseOf, cardOf, cardKeys, parseKey, clozeOf, normalize, grade, schedule, syncDeck, renameInDeck, dueToday, xpFor, dayNum };
