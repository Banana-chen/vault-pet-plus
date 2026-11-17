'use strict';
/*
 * [Plus] 카드 잇기(옛 카드 다시 보기) · 링크 정리 · 원래 Vault Pet 기록 가져오기.
 * 로직은 core/connect.js · core/review.js · core/tidy.js, 화면은 plugin/plus-modals.js. 여기는 옵시디언 · 고양이(host)와 잇는 자리다.
 * 노트를 고치는 건 applyTidy · connect 둘뿐이고, 사용자가 버튼을 눌렀을 때만 부른다.
 */
const obsidian = require('obsidian');
const { TFile } = obsidian;
const { schedule, syncDeck, renameInDeck, dueToday, dayNum, DAILY_CAP, REVIEW_XP } = require('../core/review');
const { excerptOf, neighborsOf, candidates, neighborQuiz, reasonQuiz, appendLink } = require('../core/connect');
const { findMentions, applyLink } = require('../core/tidy');
const { loadSafe } = require('./safedata');

const TIDY_XP = 20;
const CONNECT_XP = 20; // 옛 카드를 다른 카드와 이었을 때
const ORIGINAL_ID = 'vault-pet';
// 할 카드 수 · 정리할 곳 수를 다시 세는 간격 (분). 노트를 전부 읽으니 자주 하지 않는다
const RECOUNT_MIN = 10;
// 사람이 앞에 있다고 볼 만큼 최근에 만졌고, 지금 막 치는 중은 아닐 때만 말을 건다
const NUDGE_IDLE_S = [20, 600];

// correct = 이유를 적어 이은 카드 수 (한 번 볼 때 카드당 1) + 길들이기에서 맞힌 수 (진화 조건 '이은 카드'). paid = 이미 경험치를 준 연결
const REVIEW_DEFAULT = { deck: {}, seeded: false, correct: 0, done: 0, today: { day: 0, n: 0 }, days: [], nudged: 0, due: 0, paid: {} };
const TIDY_DEFAULT = { done: 0, open: 0, paid: {}, nudged: 0 };

class Plus {
  constructor(plugin) {
    this.plugin = plugin;
    this.minutes = 0;
    const st = plugin.state;
    st.set({ review: { ...REVIEW_DEFAULT, ...(st.get('review') || {}) }, tidy: { ...TIDY_DEFAULT, ...(st.get('tidy') || {}) } });
  }

  get host() {
    return this.plugin.host;
  }

  review() {
    return this.plugin.state.get('review');
  }

  tidy() {
    return this.plugin.state.get('tidy');
  }

  setReview(patch) {
    this.plugin.state.set({ review: { ...this.review(), ...patch } });
  }

  setTidy(patch) {
    this.plugin.state.set({ tidy: { ...this.tidy(), ...patch } });
  }

  files() {
    return this.plugin.app.vault.getMarkdownFiles().filter((f) => !this.plugin.isExcludedPath(f.path));
  }

  async notes() {
    const out = [];
    for (const f of this.files()) {
      try {
        const cache = this.plugin.app.metadataCache.getFileCache(f);
        const tags = cache && obsidian.getAllTags ? obsidian.getAllTags(cache) || [] : [];
        out.push({ path: f.path, title: f.basename, text: await this.plugin.app.vault.cachedRead(f), tags: [...new Set(tags)] });
      } catch {
        // 못 읽는 노트는 건너뛴다
      }
    }
    return out;
  }

  /* ── 카드 잇기 ── */

  graph() {
    return neighborsOf(this.plugin.app.metadataCache.resolvedLinks);
  }

  // 덱을 지금 노트에 맞춘다 (노트 하나 = 카드 하나). 읽은 글은 돌려줘서 다시 읽지 않게
  async syncDeck() {
    const notes = await this.notes();
    const r = this.review();
    const deck = syncDeck(r.deck, notes.map((n) => n.path), dayNum(), !r.seeded);
    const same = r.seeded && Object.keys(deck).length === Object.keys(r.deck).length && Object.keys(deck).every((k) => r.deck[k]);
    if (!same) this.setReview({ deck, seeded: true });
    return notes;
  }

  rename(from, to) {
    this.setReview({ deck: renameInDeck(this.review().deck, from, to) });
  }

  doneToday() {
    const t = this.review().today;
    return t.day === dayNum() ? t.n : 0;
  }

  // 오늘 다시 볼 카드: 글 · 지금 이어진 카드 수 · 이을 만한 카드. more(skip) 는 다른 후보를 다시 뽑는다
  async dueCards() {
    const notes = await this.syncDeck();
    const by = new Map(notes.map((n) => [n.path, n]));
    const nb = this.graph();
    const degree = Object.fromEntries(Object.entries(nb).map(([p, set]) => [p, set.size]));
    const out = dueToday(this.review().deck, dayNum(), this.doneToday(), DAILY_CAP, degree)
      .map((path) => by.get(path))
      .filter(Boolean)
      .map((note) => ({
        key: note.path,
        path: note.path,
        title: note.title,
        question: excerptOf(note.text),
        linked: (nb[note.path] || new Set()).size,
        candidates: candidates(note, notes, nb),
        more: (skip) => candidates(note, notes, nb, Math.random, 4, skip),
      }));
    this.setReview({ due: out.length });
    return out;
  }

  // 이 카드(path) 끝에 target 으로 가는 링크 한 줄을 쓴다. 이유가 없으면 잇지 않는다. 같은 연결은 한 번만 경험치
  // ('이은 카드' 수는 visit 에서 카드당 한 번만 센다 — 링크를 많이 이을수록 진화하는 게 아니다)
  async connect(path, target, reason) {
    if (!String(reason || '').trim()) return null;
    const f = this.plugin.app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) return null;
    let ok = false;
    await this.plugin.app.vault.process(f, (text) => {
      const next = appendLink(text, target, reason);
      ok = next !== null;
      return ok ? next : text;
    });
    if (!ok) return null;
    const r = this.review();
    const key = `${path}\n${target}`;
    if (r.paid[key]) return 0;
    this.setReview({ paid: { ...r.paid, [key]: Date.now() } });
    this.host.gamify.grant(CONNECT_XP, { k: 'bonus.review', v: {} });
    this.host.recomputeGrowth();
    return CONNECT_XP;
  }

  // 카드 한 장을 다 봤다 (이었든 넘겼든): 다음 상자로, 오늘 본 수 +1. 이번에 하나라도 이었으면 '이은 카드' +1
  visit(key, linked = 0) {
    const r = this.review();
    const today = dayNum();
    if (linked > 0 && this.plugin.collect) this.plugin.collect.addCorrect();
    this.setReview({
      correct: r.correct + (linked > 0 ? 1 : 0),
      deck: { ...r.deck, [key]: schedule(r.deck[key] || { b: 0, due: today }, today) },
      done: r.done + 1,
      today: { day: today, n: this.doneToday() + 1 },
      days: r.days.includes(today) ? r.days : [...r.days, today].slice(-60),
      due: Math.max(0, r.due - 1),
    });
    this.host.recomputeGrowth();
  }

  // 길들이기 문제 n 개: 내가 적은 이유로 먼저, 모자라면 이웃 문제로 (상자 · 오늘 할당량과 상관없이)
  async tameCards(n) {
    const notes = await this.notes();
    const nb = this.graph();
    const mine = reasonQuiz(notes, nb, Math.random, n);
    const used = new Set(mine.map((q) => q.path));
    return [...mine, ...neighborQuiz(notes.filter((x) => !used.has(x.path)), nb, Math.random, n - mine.length)];
  }

  // 길들이기 문제를 풀었다: 맞히면 경험치와 '이은 카드' 수
  practice(result) {
    if (result !== 'right') return 0;
    const r = this.review();
    this.setReview({ correct: r.correct + 1 });
    if (this.plugin.collect) this.plugin.collect.addCorrect();
    this.host.gamify.grant(REVIEW_XP, { k: 'bonus.review', v: {} });
    this.host.recomputeGrowth();
    return REVIEW_XP;
  }

  finish(links, total) {
    if (total) this.host.bubble(this.host.T.line('reviewDone', { right: links, total }), 'quest');
  }

  /* ── 링크 정리 ── */

  async mentions() {
    const list = findMentions(await this.notes());
    this.setTidy({ open: list.length });
    return list;
  }

  async applyTidy(m) {
    const f = this.plugin.app.vault.getAbstractFileByPath(m.path);
    if (!(f instanceof TFile)) return false;
    let ok = false;
    await this.plugin.app.vault.process(f, (text) => {
      const out = applyLink(text, m);
      ok = out !== null;
      return ok ? out : text;
    });
    if (!ok) return false;
    // 같은 노트 → 같은 대상은 한 번만 경험치 (링크를 지웠다 다시 이어도 또 주지 않는다)
    const t = this.tidy();
    const key = `${m.path}\n${m.target}`;
    if (!t.paid[key]) {
      this.setTidy({ paid: { ...t.paid, [key]: Date.now() }, done: t.done + 1 });
      this.host.gamify.grant(TIDY_XP, { k: 'bonus.tidy', v: { target: m.target } });
      this.host.recomputeGrowth();
    }
    return true;
  }

  /* ── 매분 ── */

  async tick() {
    if (this.minutes++ % RECOUNT_MIN === 0) {
      await this.dueCards();
      await this.mentions();
    }
    this.nudge();
  }

  // 하루에 한 번씩만 (복습 · 정리 따로). 방해 금지 중이면 다음 기회로
  nudge() {
    const p = this.plugin;
    const idle = p.idleSeconds();
    if (p.typing || idle < NUDGE_IDLE_S[0] || idle > NUDGE_IDLE_S[1] || this.host.isQuiet()) return;
    const today = dayNum();
    const T = this.host.T;
    const r = this.review();
    if (r.due > 0 && r.nudged !== today) {
      this.setReview({ nudged: today });
      return this.host.bubble(T.line('reviewNudge', { n: r.due }), 'quest', 'review');
    }
    const t = this.tidy();
    if (t.open > 0 && t.nudged !== today) {
      this.setTidy({ nudged: today });
      this.host.bubble(T.line('tidyFound', { n: t.open }), 'quest', 'tidy');
    }
  }
}

// 처음 켰는데 자기 기록이 없으면 원래 Vault Pet 기록을 가져오고 원래 플러그인은 끈다 (레벨 · 업적 · 노트별 기록 그대로).
// 원래 플러그인이 돌고 있으면 파일보다 새로운 메모리 속 기록을 바로 가져온다 (끌 때 저장이 끝나기를 기다리지 않아도 된다)
async function importOriginal(plugin) {
  const plugins = plugin.app.plugins;
  const live = plugins && plugins.plugins && plugins.plugins[ORIGINAL_ID];
  let raw = null;
  if (live && live.settings && live.state && live.usage) {
    raw = structuredClone({ version: 1, settings: live.settings.data, state: live.state.data, usage: live.usage.data, meta: live.meta });
  } else {
    const dir = plugin.manifest.dir.replace(/[^/]+$/, ORIGINAL_ID);
    const found = await loadSafe(plugin.app.vault.adapter, dir).catch(() => ({ raw: null }));
    raw = found.raw;
  }
  if (plugins && plugins.enabledPlugins && plugins.enabledPlugins.has(ORIGINAL_ID)) {
    await (plugins.disablePluginAndSave ? plugins.disablePluginAndSave(ORIGINAL_ID) : plugins.disablePlugin(ORIGINAL_ID));
  }
  return raw && raw.settings ? raw : null;
}

module.exports = { Plus, importOriginal };
