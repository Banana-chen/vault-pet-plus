'use strict';
/*
 * [Plus] 복습 · 링크 정리 · 원래 Vault Pet 기록 가져오기.
 * 로직은 core/review.js · core/tidy.js, 화면은 plugin/plus-modals.js. 여기는 옵시디언 · 고양이(host)와 잇는 자리다.
 * 노트를 고치는 건 applyTidy 하나뿐이고, 사용자가 버튼을 눌렀을 때만 부른다.
 */
const { TFile } = require('obsidian');
const { cardOf, cardKeys, parseKey, clozeOf, schedule, syncDeck, renameInDeck, dueToday, xpFor, dayNum, DAILY_CAP, REVIEW_XP } = require('../core/review');
const { findMentions, applyLink } = require('../core/tidy');
const { FOODS } = require('../core/shop');
const { loadSafe } = require('./safedata');

const TIDY_XP = 20;
const ORIGINAL_ID = 'vault-pet';
// 할 카드 수 · 정리할 곳 수를 다시 세는 간격 (분). 노트를 전부 읽으니 자주 하지 않는다
const RECOUNT_MIN = 10;
// 사람이 앞에 있다고 볼 만큼 최근에 만졌고, 지금 막 치는 중은 아닐 때만 말을 건다
const NUDGE_IDLE_S = [20, 600];

const REVIEW_DEFAULT = { deck: {}, seeded: false, correct: 0, done: 0, today: { day: 0, n: 0 }, days: [], nudged: 0, due: 0 };
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
        out.push({ path: f.path, title: f.basename, text: await this.plugin.app.vault.cachedRead(f) });
      } catch {
        // 못 읽는 노트는 건너뛴다
      }
    }
    return out;
  }

  /* ── 복습 ── */

  // 덱을 지금 노트에 맞춘다 (제목 카드 + 형광펜 카드). 읽은 글은 돌려줘서 다시 읽지 않게
  async syncDeck() {
    const notes = await this.notes();
    const r = this.review();
    const deck = syncDeck(r.deck, notes.flatMap((n) => cardKeys(n.path, n.text)), dayNum(), !r.seeded);
    const same = r.seeded && Object.keys(deck).length === Object.keys(r.deck).length && Object.keys(deck).every((k) => r.deck[k]);
    if (!same) this.setReview({ deck, seeded: true });
    return new Map(notes.map((n) => [n.path, n]));
  }

  rename(from, to) {
    this.setReview({ deck: renameInDeck(this.review().deck, from, to) });
  }

  doneToday() {
    const t = this.review().today;
    return t.day === dayNum() ? t.n : 0;
  }

  // 오늘 낼 카드. 첫 단락이 없는 노트는 문제가 안 되니 건너뛰고 다음 카드를 채운다
  async dueCards() {
    const notes = await this.syncDeck();
    const room = DAILY_CAP - this.doneToday();
    const out = [];
    for (const key of dueToday(this.review().deck, dayNum(), 0, Infinity)) {
      if (out.length >= room) break;
      const { path, highlight } = parseKey(key);
      const note = notes.get(path);
      if (!note) continue;
      const card = highlight === null ? cardOf(note.title, note.text) : clozeOf(note.text, highlight);
      if (card) out.push({ key, path, ...card });
    }
    this.setReview({ due: out.length });
    return out;
  }

  // result: 'right' | 'wrong'. 힌트를 쓰고 맞힌 건 경험치 반 · 상자 그대로 · 진화용 '맞힌 수'에는 안 센다
  answer(key, result, hinted) {
    const r = this.review();
    const today = dayNum();
    const card = r.deck[key] || { b: 0, due: today };
    this.setReview({
      deck: { ...r.deck, [key]: schedule(card, result, today, hinted) },
      done: r.done + 1,
      correct: r.correct + (result === 'right' && !hinted ? 1 : 0),
      today: { day: today, n: this.doneToday() + 1 },
      days: r.days.includes(today) ? r.days : [...r.days, today].slice(-60),
      due: Math.max(0, r.due - 1),
    });
    if (result === 'right' && !hinted && this.plugin.collect) this.plugin.collect.addCorrect();
    const xp = xpFor(result, hinted);
    if (xp) this.host.gamify.grant(xp, { k: 'bonus.review', v: {} });
    this.host.recomputeGrowth();
    return xp;
  }

  // 길들이기 문제: 제목 카드 n 장을 아무거나 (상자 · 오늘 할당량과 상관없이)
  async randomCards(n) {
    const pool = (await this.notes()).map((note) => ({ note, card: cardOf(note.title, note.text) })).filter((x) => x.card);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, n).map(({ note, card }) => ({ key: note.path, path: note.path, ...card }));
  }

  // 길들이기 문제를 풀었다: 경험치와 맞힌 수는 주지만 상자는 건드리지 않는다
  practice(result) {
    if (result !== 'right') return 0;
    const r = this.review();
    this.setReview({ correct: r.correct + 1 });
    if (this.plugin.collect) this.plugin.collect.addCorrect();
    this.host.gamify.grant(REVIEW_XP, { k: 'bonus.review', v: {} });
    this.host.recomputeGrowth();
    return REVIEW_XP;
  }

  finish(right, total) {
    if (total) this.host.bubble(this.host.T.line('reviewDone', { right, total }), 'quest');
  }

  snacks() {
    const pantry = this.plugin.state.get('pantry') || {};
    return FOODS.filter((x) => x.group === 'snack' && pantry[x.key] > 0).sort((a, b) => a.price - b.price);
  }

  snackCount() {
    const pantry = this.plugin.state.get('pantry') || {};
    return this.snacks().reduce((n, x) => n + pantry[x.key], 0);
  }

  // 냄새 맡기: 제일 싼 간식 하나를 고양이에게 준다 (바닥에 떨어진 걸 먹으러 간다). 줬으면 true
  hint() {
    const [snack] = this.snacks();
    return !!snack && this.host.giveFood(snack.key);
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
