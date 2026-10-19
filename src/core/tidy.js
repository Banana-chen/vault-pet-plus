'use strict';
// [Plus] 링크 정리: 다른 노트의 제목이 글에 나오는데 링크가 아닌 곳을 찾는다.
// 고치는 건 사용자가 버튼을 눌렀을 때만 (plugin/plus.js). 여기는 찾기와 바꾼 글 만들기뿐이다.
const { answersOf } = require('./review');

const SNIPPET = 16;
const UNLINKABLE = /[|#^[\]]/;
const ASCII_WORD = /[A-Za-z0-9]/;

// 이름이 너무 짧으면 엉뚱한 곳에 걸린다. 한자가 섞이면 2자, 영어만이면 3자부터
const aliasOk = (a) => (/[^\x00-\x7f]/.test(a) ? a.length >= 2 : a.length >= 3);

// 링크로 만들면 안 되는 자리(frontmatter · 코드 · 이미 있는 링크)를 같은 길이 공백으로 지운다 (위치는 그대로)
function blankProtected(text) {
  const wipe = (m) => m.replace(/[^\n]/g, ' ');
  return text
    .replace(/^---\n[\s\S]*?\n---\n?/, wipe)
    .replace(/```[\s\S]*?(```|$)/g, wipe)
    .replace(/`[^`\n]*`/g, wipe)
    .replace(/!?\[\[[^\]]*\]\]/g, wipe)
    .replace(/!?\[[^\]\n]*\]\([^)\n]*\)/g, wipe)
    .replace(/https?:\/\/\S+/g, wipe);
}

function wordEdge(text, i, alias) {
  const before = text[i - 1] || '';
  const after = text[i + alias.length] || '';
  if (ASCII_WORD.test(alias[0]) && ASCII_WORD.test(before)) return false;
  if (ASCII_WORD.test(alias[alias.length - 1]) && ASCII_WORD.test(after)) return false;
  return true;
}

function firstHit(clean, aliases) {
  let best = null;
  for (const alias of aliases) {
    let i = clean.indexOf(alias);
    while (i >= 0 && !wordEdge(clean, i, alias)) i = clean.indexOf(alias, i + 1);
    if (i >= 0 && (!best || i < best.index || (i === best.index && alias.length > best.alias.length))) best = { index: i, alias };
  }
  return best;
}

const linkText = (target, alias) => (alias === target ? `[[${target}]]` : `[[${target}|${alias}]]`);

// notes = [{ path, title, text }] → [{ path, target, alias, index, before, after }]
function findMentions(notes) {
  const targets = notes
    .filter((n) => !UNLINKABLE.test(n.title))
    .map((n) => ({ path: n.path, title: n.title, aliases: answersOf(n.title).filter(aliasOk) }))
    .filter((t) => t.aliases.length);
  const out = [];
  for (const note of notes) {
    const clean = blankProtected(note.text);
    for (const t of targets) {
      if (t.path === note.path || note.text.includes(`[[${t.title}`)) continue;
      const hit = firstHit(clean, t.aliases);
      if (!hit) continue;
      const from = Math.max(0, hit.index - SNIPPET);
      const to = hit.index + hit.alias.length;
      const head = note.text.slice(from, hit.index);
      const tail = note.text.slice(to, to + SNIPPET);
      out.push({ path: note.path, target: t.title, alias: hit.alias, index: hit.index, before: head + hit.alias + tail, after: head + linkText(t.title, hit.alias) + tail });
    }
  }
  return out;
}

// 찾은 그 자리를 링크로 바꾼 새 글. 그사이 글이 바뀌어 그 자리에 그 말이 없으면 null
function applyLink(text, m) {
  if (text.slice(m.index, m.index + m.alias.length) !== m.alias) return null;
  return text.slice(0, m.index) + linkText(m.target, m.alias) + text.slice(m.index + m.alias.length);
}

module.exports = { findMentions, applyLink };
