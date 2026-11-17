'use strict';
// [Plus] 카드 잇기 (루만의 메모 상자식 복습): 옛 카드를 다시 보고 이을 만한 카드를 권한다. 외우기 시험이 아니다.
//  - candidates: 이 카드와 이을 만한 카드 (서로 언급 · 같은 태그 · 같은 이웃 둘 + 우연히 뽑은 둘)
//  - reasonQuiz: 길들이기 문제. 내가 적은 이유를 보고 그 이유로 이은 카드를 고른다
//  - neighborQuiz: 이유 문제가 모자랄 때. 이 카드와 정말 이어진 카드를 보기 넷 중에 고른다 (정답은 볼트의 실제 링크)
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
// 이미 이어진 카드는 빼고, 점수 높은 n-2 장 + 우연히 뽑은 두 장 (뻔한 연결은 이미 안다. 새 생각은 뜻밖의 연결에서 나온다)
const LUCKY = 2;
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
  const lucky = shuffle(rest, rand).slice(0, Math.max(LUCKY, n - scored.length));
  const sure = scored.slice(0, Math.max(n - lucky.length, n - LUCKY));
  return [...sure, ...lucky].slice(0, n).map((x) => x.c);
}

// 노트에 적힌 '- [[대상]]：이유' 줄 (appendLink 가 쓰는 꼴, 반각 ':' 도 받는다). 이유가 빈 줄은 뺀다
const REASON_LINE = /^- \[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]\s*[：:]\s*(\S.*)$/;
function reasonsOf(text) {
  return String(text).split('\n').map((l) => l.trim().match(REASON_LINE)).filter(Boolean).map((m) => ({ target: m[1].trim(), reason: m[2].trim() }));
}

// 길들이기 문제: 내가 적은 이유를 보여 주고, 이 카드가 그 이유로 이은 카드를 고른다.
// 이유 없는 링크는 문제가 안 된다 — 대충 이은 링크로는 길들이기에 도움이 안 된다
// 정답은 제목이 같고 실제로 이어진 카드 (같은 제목이 여러 폴더에 있어도 옵시디언이 고른 쪽). 못 찾으면 문제를 내지 않는다
function reasonQuiz(notes, nb, rand = Math.random, n = 3, size = 4) {
  // [[폴더/제목]] 처럼 경로로 적은 링크는 끝 이름으로 찾는다 (어느 쪽인지는 실제 링크가 정한다)
  const nameOf = (target) => target.split('/').pop();
  const pool = notes.flatMap((note) => reasonsOf(note.text).filter((r) => nameOf(r.target) !== note.title).map((r) => ({ note, ...r })));
  const out = [];
  for (const { note, target, reason } of shuffle(pool, rand)) {
    if (out.length >= n) break;
    if (out.some((q) => q.path === note.path)) continue;
    const name = nameOf(target);
    const near = nb[note.path] || new Set();
    const hit = notes.find((o) => o.title === name && near.has(o.path));
    const far = notes.filter((o) => o.path !== note.path && o.title !== name && !near.has(o.path));
    if (!hit || far.length < size - 1) continue;
    const options = shuffle([hit, ...shuffle(far, rand).slice(0, size - 1)], rand).map((o) => ({ path: o.path, title: o.title }));
    out.push({ path: note.path, title: note.title, question: reason, options, answer: hit.path, kind: 'reason' });
  }
  return out;
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

module.exports = { excerptOf, neighborsOf, candidates, neighborQuiz, reasonsOf, reasonQuiz, appendLink };
