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
function answersOf(title) {
  const t = String(title).trim();
  const m = t.match(/^(.+?)\s*[(（]([^()（）]+)[)）]\s*(.*)$/);
  const list = m ? [t, (m[1] + m[3]).trim(), m[2].trim(), m[3] ? m[1].trim() : ''] : [t];
  return [...new Set(list.filter(Boolean))];
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

function maskTerms(answers) {
  const latin = (answers[1] || '').match(/[A-Za-z][A-Za-z0-9]{2,}/g) || [];
  return [...new Set([...answers, ...latin])].sort((a, b) => b.length - a.length);
}

const normalize = (s) => String(s).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');

// 정답에는 머리글자도 넣는다 (DLQ 로 답해도 맞다). 머리글자는 문제에서도 가려진다
function cardOf(title, text) {
  const answers = [...new Set([...answersOf(title), ...initialsOf(answersOf(title))])];
  let question = firstParagraph(text);
  // 영어로 시작 · 끝나는 말은 낱말 안쪽(safe 속 'fe')을 가리지 않게 경계를 본다
  const edge = (term) => `${/^[A-Za-z0-9]/.test(term) ? '(?<![A-Za-z0-9])' : ''}${escapeRe(term)}${/[A-Za-z0-9]$/.test(term) ? '(?![A-Za-z0-9])' : ''}`;
  for (const term of maskTerms(answers)) question = question.replace(new RegExp(edge(term), 'gi'), BLANK);
  if (normalize(question.split(BLANK).join('')).length < 4) return null;
  return { answers, question };
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
  return { answers: [highlight], question };
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

// 'right' | 'close' | 'wrong'. close 는 맞았는지 본인이 고른다 (오타 · 簡繁 차이)
function grade(input, answers) {
  const n = normalize(input);
  if (!n) return 'wrong';
  const keys = answers.map(normalize).filter(Boolean);
  if (keys.includes(n)) return 'right';
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

module.exports = { BLANK, BOX_DAYS, DAILY_CAP, REVIEW_XP, answersOf, cardOf, cardKeys, parseKey, clozeOf, normalize, grade, schedule, syncDeck, renameInDeck, dueToday, xpFor, dayNum };
