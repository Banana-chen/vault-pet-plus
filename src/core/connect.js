'use strict';
// [Plus] 카드 잇기 (루만의 메모 상자식 복습): 옛 카드를 다시 보고 이을 만한 카드를 권한다. 외우기 시험이 아니다.
//  - candidates: 이 카드와 이을 만한 카드 (서로 언급 · 같은 태그 · 같은 이웃 + 우연히 뽑은 한 장)
//  - neighborQuiz: 길들이기 문제. 이 카드와 정말 이어진 카드를 보기 넷 중에 고른다 (정답은 볼트의 실제 링크)
//  - appendLink: 노트 끝에 '- [[대상]]：이유' 한 줄. 사용자가 버튼을 눌렀을 때만 쓴다 (plugin/plus.js)
const { namesOf, firstParagraph } = require('./review');
const { aliasOk } = require('./tidy');

const EXCERPT = 120;
const excerptOf = (text) => firstParagraph(text).replace(/\s+/g, ' ').slice(0, EXCERPT);

// resolvedLinks { src: { dst: n } } → 방향 없는 이웃 표 { path: Set }
function neighborsOf(resolved) {
  const nb = {};
  const add = (a, b) => (nb[a] || (nb[a] = new Set())).add(b);
  for (const [src, targets] of Object.entries(resolved || {})) {
    for (const dst of Object.keys(targets)) {
      if (dst === src) continue;
      add(src, dst);
      add(dst, src);
    }
  }
  return nb;
}

function shuffle(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const mentions = (a, b) => namesOf(b.title).filter(aliasOk).some((alias) => a.text.toLowerCase().includes(alias.toLowerCase()));

// notes = [{ path, title, text, tags }] → [{ path, title, excerpt, why, via }] (why: mention | tag | neighbor | random)
// 이미 이어진 카드는 빼고, 점수 높은 n-1 장 + 우연히 뽑은 한 장 (뜻밖의 연결도 메모 상자의 맛)
function candidates(note, notes, nb, rand = Math.random, n = 4, skip = []) {
  const mine = nb[note.path] || new Set();
  const titles = new Map(notes.map((x) => [x.path, x.title]));
  const scored = [];
  const rest = [];
  for (const o of notes) {
    if (o.path === note.path || mine.has(o.path) || skip.includes(o.path) || note.text.includes(`[[${o.title}`)) continue;
    const tag = (note.tags || []).find((t) => (o.tags || []).includes(t));
    const shared = [...mine].find((p) => (nb[o.path] || new Set()).has(p));
    let score = 0, why = null, via = '';
    if (shared) { score += 2; why = 'neighbor'; via = titles.get(shared) || ''; }
    if (tag) { score += 2; why = 'tag'; via = tag; }
    if (mentions(note, o) || mentions(o, note)) { score += 5; why = 'mention'; via = ''; }
    const c = { path: o.path, title: o.title, excerpt: excerptOf(o.text), why: why || 'random', via };
    (score ? scored : rest).push({ score: score + rand() * 0.5, c });
  }
  scored.sort((a, b) => b.score - a.score);
  const lucky = shuffle(rest, rand).slice(0, Math.max(1, n - scored.length));
  return [...scored.slice(0, n - 1), ...lucky].slice(0, n).map((x) => x.c);
}

// 이웃이 있는 카드 n 장으로 문제를 낸다: { path, title, question, options: [{ path, title }], answer }
function neighborQuiz(notes, nb, rand = Math.random, n = 3, size = 4) {
  const by = new Map(notes.map((x) => [x.path, x]));
  const out = [];
  for (const note of shuffle(notes, rand)) {
    if (out.length >= n) break;
    const near = [...(nb[note.path] || [])].filter((p) => by.has(p));
    const far = notes.filter((o) => o.path !== note.path && !near.includes(o.path));
    if (!near.length || far.length < size - 1) continue;
    const answer = near[Math.floor(rand() * near.length)];
    const options = shuffle([by.get(answer), ...shuffle(far, rand).slice(0, size - 1)], rand).map((o) => ({ path: o.path, title: o.title }));
    out.push({ path: note.path, title: note.title, question: excerptOf(note.text), options, answer });
  }
  return out;
}

// 노트 끝에 링크 한 줄. 이미 그 카드로 가는 링크가 있으면 null. 끝이 링크 목록이면 바로 이어 붙인다
function appendLink(text, target, reason = '') {
  if (text.includes(`[[${target}]]`) || text.includes(`[[${target}|`)) return null;
  const body = text.replace(/\s+$/, '');
  const why = String(reason).replace(/\s+/g, ' ').trim();
  const last = body.split('\n').pop() || '';
  return `${body}${body ? (/^- \[\[/.test(last) ? '\n' : '\n\n') : ''}- [[${target}]]${why ? `：${why}` : ''}\n`;
}

module.exports = { excerptOf, neighborsOf, candidates, neighborQuiz, appendLink };
