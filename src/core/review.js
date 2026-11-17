'use strict';
// [Plus] 다시 볼 카드의 일정 (노트 하나 = 카드 하나). 무엇을 하는지는 core/connect.js (카드 잇기).
// 저장하는 건 상자 번호와 다음 날짜뿐이다. 2026-11 까지는 제목 · 형광펜을 가리고 맞히는 외우기 시험이었다

// 상자 0~4 의 간격 (일). 다시 볼 때마다 다음 상자
const BOX_DAYS = [1, 2, 4, 8, 16];
const DAILY_CAP = 10;
const REVIEW_XP = 15; // 길들이기 문제를 맞혔을 때
const QUESTION_MAX = 300;

// 'CDP(Chrome DevTools Protocol)' → [전체, 'CDP', 'Chrome DevTools Protocol']. 괄호는 전각도 받는다.
// 괄호가 가운데 있으면 ('共變數(Covariates)陷阱') 괄호 밖을 이은 이름 · 괄호 안 · 괄호 앞 이름
// 괄호만 보는 이름들. 링크 정리(tidy)는 이것만 쓴다 — 나뉜 제목의 한쪽('Kafka')마다 링크를 권하면 안 되니까
function namesOf(title) {
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

// card = { b: 상자, due: 다음 날 (dayNum) }. 다시 볼 때마다 다음 상자로 (틀리는 일이 없다: 잇든 넘기든 한 번 본 것)
function schedule(card, today) {
  const b = Math.min(card.b + 1, BOX_DAYS.length - 1);
  return { b, due: today + BOX_DAYS[b] };
}

// 지금 노트 목록에 맞춘 새 덱. 처음엔 전부 오늘부터, 그 뒤에 생긴 노트는 내일부터
function syncDeck(deck, paths, today, first) {
  const out = {};
  for (const p of paths) out[p] = deck[p] || { b: 0, due: first ? today : today + 1 };
  return out;
}

// 노트 · 폴더 이름이 바뀌면 그 아래 카드를 옮긴다
function renameInDeck(deck, from, to) {
  const moved = (path) => (path === from ? to : path.startsWith(from + '/') ? to + path.slice(from.length) : path);
  return Object.fromEntries(Object.entries(deck).map(([k, c]) => [moved(k), c]));
}

// 오늘 낼 카드: 이어진 카드가 적은 것(외톨이)부터, 그다음 오래 밀린 것부터, 하루 DAILY_CAP 장까지
// degree = { path: 이웃 수 } (없으면 밀린 순서만)
function dueToday(deck, today, doneToday, cap = DAILY_CAP, degree = {}) {
  const d = (p) => degree[p] || 0;
  return Object.entries(deck)
    .filter(([, c]) => c.due <= today)
    .sort((a, b) => d(a[0]) - d(b[0]) || a[1].due - b[1].due || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, cap - doneToday))
    .map(([p]) => p);
}

// 현지 시각 기준 날짜 번호
const dayNum = (d = new Date()) => Math.floor((d.getTime() - d.getTimezoneOffset() * 60_000) / 86_400_000);

module.exports = { BOX_DAYS, DAILY_CAP, REVIEW_XP, namesOf, firstParagraph, schedule, syncDeck, renameInDeck, dueToday, dayNum };
