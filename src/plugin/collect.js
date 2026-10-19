'use strict';
/*
 * [Plus] 고양이 모으기를 옵시디언 · 고양이(host)와 잇는 자리. 규칙은 core/collection.js, 품종은 core/breeds.js.
 *  - 데려온 고양이만 경험치를 받는다 (growthOpts → host.recomputeGrowth)
 *  - 고양이마다 생김새(털색 · 귀 · 코스튬)와 이름을 따로 기억한다. 바꿀 때 설정에 갈아 끼운다
 *  - 길고양이는 동네 친구 자리(pet:friend)를 빌려 바탕화면에 온다. 누르면 길들이기 창 (plugin/tame-modal.js)
 */
const C = require('../core/collection');
const { breedOf } = require('../core/breeds');
const { xpOf, levelOf } = require('../core/growth');
const { dayNum } = require('../core/review');

const RECHECK_MIN = 10; // 만남 조건을 다시 보는 간격 (분)
const NAME_MAX = 12; // 설정의 고양이 이름과 같은 길이 (host.js 의 house:set)
const RAW_TTL = 1000; // raw() 를 한 번 계산하면 이만큼 다시 쓴다 (매분 여러 번 부르니)
const PRESENT_S = 120; // 이만큼 안에 만졌으면 사람이 앞에 있다
const BIG_NOTE = 2000;

class Collector {
  constructor(plugin) {
    this.plugin = plugin;
    this.minutes = 0;
    this.lastChars = null;
    this.shown = null; // 펫 판에 보낸 길고양이 (at)
    const st = plugin.state;
    if (!st.get('herd')) {
      const review = st.get('review') || {};
      // 지금 고양이가 이미 진화했으면 그 단계가 바닥
      st.set({ herd: C.notePeak(C.seed({ correct: review.correct || 0 }, Date.now()), st.get('lastStage') || 0) });
    }
  }

  get host() {
    return this.plugin.host;
  }

  herd() {
    return this.plugin.state.get('herd');
  }

  set(next) {
    this.plugin.state.set({ herd: next });
  }

  since() {
    return this.plugin.state.get('startedAt') || 0;
  }

  // 볼트 전체 경험치 · 글자 수 (고양이마다 나누기 전). 기록 전체를 훑으니 잠깐 기억해 둔다
  raw() {
    const now = Date.now();
    if (this.rawMemo && now - this.rawMemo.at < RAW_TTL) return this.rawMemo.v;
    const { usage, gamify } = this.host;
    const totals = usage.totals(this.since());
    const v = { raw: xpOf(totals) + gamify.bonusXp(this.since()), chars: totals.c || 0 };
    this.rawMemo = { at: now, v };
    return v;
  }

  active() {
    return this.herd().active;
  }

  growthOpts() {
    const s = this.herd();
    return { stages: breedOf(s.active).stages, adjust: C.xpAdjust(s) };
  }

  habits() {
    const { chars } = this.raw();
    return { ...C.habitsOf(this.herd(), this.active(), { chars, links: this.plugin.linkStats().total }), floor: C.peakOf(this.herd()) };
  }

  // 지금 고양이가 오른 단계를 기억한다 (고양이마다 따로인 진화 바닥)
  notePeak(stage) {
    const s = this.herd();
    const next = C.notePeak(s, stage);
    if (next !== s) this.set(next);
  }

  // 털색 · 상점 물건을 여는 레벨: 모은 고양이 중 가장 높은 레벨 (새 고양이를 데려와도 이미 연 건 그대로)
  unlockLevel(current) {
    const s = this.herd();
    const { raw } = this.raw();
    return Math.max(current, ...C.caught(s).map((k) => levelOf(C.catXp(s, k, raw))));
  }

  stages() {
    return breedOf(this.active()).stages;
  }

  addCorrect() {
    this.set(C.addCorrect(this.herd()));
  }

  /* ── 고양이 바꾸기 · 데려오기 ── */

  lookNow() {
    const s = this.plugin.settings;
    return { fur: s.get('fur'), ears: s.get('ears'), outfit: s.get('outfit') || {}, name: s.get('petName') };
  }

  lookOf(key) {
    const c = this.herd().cats[key];
    const b = breedOf(c.breed);
    return { fur: b.fur, ears: b.ears, outfit: {}, name: this.host.T.t('breed.' + c.breed), ...(c.look || {}) };
  }

  // key 는 하우스 iframe 에서 온다: 데려온 고양이 이름(자기 키)만 받는다
  switchTo(key) {
    const s0 = this.herd();
    if (!C.has(s0, key) || key === s0.active) return false;
    this.rawMemo = null;
    const st = this.plugin.state;
    // 지금 고양이의 생김새 · 화면 기억을 맡겨 두고
    let s = C.setCat(s0, s0.active, { look: this.lookNow(), lastLevel: st.get('lastLevel'), lastStage: st.get('lastStage') });
    s = C.switchTo(s, key, this.raw());
    this.set(s);
    const next = s.cats[key];
    const look = this.lookOf(key);
    this.plugin.settings.set({ fur: look.fur, ears: look.ears, outfit: look.outfit, petName: String(look.name).slice(0, NAME_MAX) });
    // 바꾸기 직전에 쓴 글이 새 고양이의 '쓴 날'로 잡히지 않게
    this.lastChars = this.raw().chars;
    // 처음 데려온 고양이는 레벨 기억이 없다 → 레벨업 축하 없이 조용히 맞춘다
    st.set({ lastLevel: next.lastLevel, lastStage: next.lastStage || 0 });
    this.host.syncAccessory();
    this.host.recomputeGrowth();
    this.host.send('pet:config', this.host.petConfig());
    this.host.send('pet:action', 'happy');
    return true;
  }

  adopt(breed, name) {
    const now = Date.now();
    let s = C.adopt(this.herd(), breed, { ...this.raw(), now });
    const b = breedOf(breed);
    const nm = String(name || this.host.T.t('breed.' + breed)).trim().slice(0, NAME_MAX);
    this.set(C.setCat(s, breed, { look: { fur: b.fur, ears: b.ears, outfit: {}, name: nm } }));
    // 바탕화면의 길고양이는 이제 우리 고양이가 됐으니 내보낸다
    this.dismissStray();
  }

  // 길고양이를 내보낸다 (떠남 · 달아남 · 데려옴)
  dismissStray() {
    this.set(C.endStray(this.herd()));
    if (this.shown) this.host.send('pet:friend-leave');
    this.shown = null;
  }

  summary() {
    const s = this.herd();
    const { raw } = this.raw();
    const cats = C.caught(s).map((key) => {
      const c = s.cats[key];
      const look = key === s.active ? this.lookNow() : this.lookOf(key);
      const level = key === s.active && this.host.growth ? this.host.growth.level : levelOf(C.catXp(s, key, raw));
      const stages = breedOf(c.breed).stages;
      const stage = key === s.active && this.host.growth ? this.host.growth.stageKey : stages[Math.min(c.peak || 0, stages.length - 1)].key;
      const acc = Object.values(look.outfit || {}).filter(Boolean).join(',') || 'none';
      return { key, breed: c.breed, name: look.name, fur: look.fur, ears: look.ears, acc, level, stage, active: key === s.active, at: c.at };
    });
    const seen = Object.keys(s.seen).filter((k) => !s.cats[k]).map((k) => ({ breed: k, stage: breedOf(k).stages[0].key }));
    return { cats, seen };
  }

  /* ── 매분 ── */

  tick() {
    const now = Date.now();
    const today = dayNum();
    this.recordWriting(today);
    if (this.minutes++ % RECHECK_MIN === 0) this.checkEncounters(today);
    this.strayTick(now, today);
  }

  recordWriting(today) {
    const { chars } = this.raw();
    if (this.lastChars != null && chars > this.lastChars) this.set(C.recordActivity(this.herd(), today, new Date().getHours()));
    this.lastChars = chars;
  }

  metrics(today) {
    const p = this.plugin;
    const st = p.state;
    const review = st.get('review') || {};
    const usage = this.host.usage;
    const t = usage.today();
    const days = new Set(review.days || []);
    let streak = 0;
    while (days.has(today - streak)) streak++;
    const wrote = (t.c || 0) > 0;
    const dow = new Date().getDay();
    const h = new Date().getHours();
    const files = Object.values(usage.data.files || {});
    const bonus = st.get('bonus') || [];
    return {
      chars: this.raw().chars,
      correct: review.correct || 0,
      links: p.linkStats().total,
      tidy: (st.get('tidy') || {}).done || 0,
      streak,
      night: wrote && C.isNight(h),
      weekend: wrote && (dow === 0 || dow === 6),
      notesToday: t.n || 0,
      bigNotes: files.filter((f) => (f[0] || 0) >= BIG_NOTE).length,
      allClear: bonus.some((b) => b && b.why && b.why.k === 'bonus.allclear'),
    };
  }

  checkEncounters(today) {
    const r = C.checkTriggers(this.herd(), this.metrics(today), today);
    this.set(C.rollDaily(r.state, today));
  }

  present() {
    const p = this.plugin;
    return p.idleSeconds() < PRESENT_S && !this.host.isQuiet() && this.host.petVisible() && !(this.host.friends && this.host.friends.current());
  }

  strayTick(now, today) {
    let s = this.herd();
    if (s.stray && !C.strayHere(s, now)) return this.dismissStray();
    if (s.stray) return this.showStray();
    if (!C.ticketDue(s, today) || !this.present()) return;
    const breed = C.pickBreed(s);
    // 다 모았으면 표는 쓸모가 없다
    if (!breed) return this.set({ ...s, tickets: [] });
    s = C.startStray(s, breed, today, now);
    this.set(s);
    this.showStray();
    const T = this.host.T;
    this.host.bubble(T.line('strayHere'), 'quest', 'tame');
  }

  // 펫 판에 길고양이를 보낸다 (펫 판을 새로 만들었으면 다시)
  showStray() {
    const s = this.herd();
    if (!s.stray || this.shown === s.stray.at) return;
    const b = breedOf(s.stray.breed);
    this.host.send('pet:friend', { id: 'stray', kind: 'stray', until: s.stray.until, stray: { stage: b.stages[0].key, fur: b.fur, ears: b.ears } });
    this.shown = s.stray.at;
  }

  stray() {
    const s = this.herd();
    return C.strayHere(s, Date.now()) ? s.stray : null;
  }

  // 길들이기에 실패하면 달아난다
  runAway() {
    this.dismissStray();
  }

  // 펫 판을 새로 만들었다: 길고양이가 와 있으면 다음 tick 에 다시 보낸다
  petReloaded() {
    this.shown = null;
  }

  // 길고양이가 와 있는 동안은 동네 친구가 안 온다
  blocksFriends() {
    return !!this.stray();
  }
}

module.exports = { Collector };
