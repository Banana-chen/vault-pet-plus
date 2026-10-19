'use strict';
/*
 * Vault Pet Plus 고양이 모으기 검사 (품종 · 고양이마다 따로 자라기 · 만남 · 길들이기).   node tests/collect.js
 */
const path = require('path');
const assert = require('assert');

const src = path.join(__dirname, '..', 'src');
const C = require(path.join(src, 'core/collection'));
const { BREEDS, breedOf } = require(path.join(src, 'core/breeds'));
const growth = require(path.join(src, 'core/growth'));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/* ── 품종 ── */

test('breeds: 8 품종, 처음 고양이는 원래 진화 조건 그대로, 품종마다 단계 열쇠가 겹치지 않는다', () => {
  assert.strictEqual(BREEDS.length, 8);
  const cheese = breedOf('cheese');
  assert.deepStrictEqual(cheese.stages.map((s) => s.key), ['cat', 'cat2', 'cat3']);
  assert.deepStrictEqual(cheese.stages[1].need, { level: 15, links: 10, correct: 20 });
  const keys = BREEDS.flatMap((b) => b.stages.map((s) => s.key));
  assert.strictEqual(new Set(keys).size, keys.length);
  for (const b of BREEDS) {
    assert.strictEqual(b.stages.length, 3, b.key);
    assert.ok(b.stages[1].need.level < b.stages[2].need.level, b.key);
    // 진화 조건마다 레벨 + 그 품종의 습관이 적어도 하나
    assert.ok(Object.keys(b.stages[1].need).length >= 2, b.key);
  }
  assert.ok(BREEDS.filter((b) => b.rarity === 'rare').length >= 1);
});

/* ── 처음 상태 ── */

test('seed: 지금 고양이(치즈)가 첫 고양이, 경험치는 그대로, 맞힌 문제도 이어받는다', () => {
  const s = C.seed({ correct: 20 });
  assert.strictEqual(s.active, 'cheese');
  assert.deepStrictEqual(Object.keys(s.cats), ['cheese']);
  assert.strictEqual(C.xpAdjust(s), 0, '치즈는 지금까지 쓴 걸 그대로 다 가진다');
  assert.strictEqual(s.cats.cheese.correct, 20);
  assert.ok(s.seen.cheese != null);
});

/* ── 고양이마다 따로 자란다 ── */

test('switchTo: 데려온 고양이만 경험치를 받고, 쉬는 고양이는 그 자리에 멈춘다', () => {
  let s = C.seed({ correct: 0 });
  s = C.adopt(s, 'puff', { raw: 1000, chars: 8000, now: 1 });
  assert.strictEqual(s.active, 'cheese', '데려오기만 하고 아직 안 바꿨다');
  s = C.switchTo(s, 'puff', { raw: 1000, chars: 8000 });
  assert.strictEqual(s.active, 'puff');
  // 새 고양이는 0 부터
  assert.strictEqual(1000 + C.xpAdjust(s), 0);
  // 더 써서 raw 1300 이 되면 새 고양이만 300
  assert.strictEqual(1300 + C.xpAdjust(s), 300);
  assert.strictEqual(C.catXp(s, 'cheese', 1300), 1000, '치즈는 바꾸기 전 1000 에 멈춘다');
  // 다시 치즈로: 치즈는 1000 에서 이어 간다
  s = C.switchTo(s, 'cheese', { raw: 1300, chars: 9000 });
  assert.strictEqual(1500 + C.xpAdjust(s), 1200);
  assert.strictEqual(C.catXp(s, 'puff', 1500), 300);
});

test('habitsOf: 글자 · 맞힌 문제 · 밤 · 날은 고양이마다, 링크는 볼트 전체', () => {
  let s = C.seed({ correct: 5 });
  s = C.adopt(s, 'puff', { raw: 0, chars: 100, now: 1 });
  s = C.switchTo(s, 'puff', { raw: 0, chars: 100 });
  s = C.addCorrect(s);
  s = C.recordActivity(s, 300, 23);
  s = C.recordActivity(s, 300, 23);
  s = C.recordActivity(s, 301, 14);
  const h = C.habitsOf(s, 'puff', { chars: 600, links: 9 });
  assert.deepStrictEqual(h, { chars: 500, correct: 1, links: 9, nights: 1, days: 2 });
  assert.strictEqual(C.habitsOf(s, 'cheese', { chars: 600, links: 9 }).correct, 5);
});

test('growth: 품종마다 단계 · 조건이 다르고, 조건은 레벨 + 그 품종의 습관', () => {
  const stages = breedOf('puff').stages;
  const usage = { totals: () => ({ c: 0 }) };
  const need = stages[1].need;
  const xpAt = (lv) => 25 * (lv - 1) ** 2;
  const g1 = growth.computeGrowth(0, usage, () => xpAt(need.level), { chars: need.chars - 1 }, { stages });
  assert.strictEqual(g1.stageKey, stages[0].key);
  assert.strictEqual(g1.nextNeed.chars, need.chars);
  assert.strictEqual(g1.have.chars, need.chars - 1);
  const g2 = growth.computeGrowth(0, usage, () => xpAt(need.level), { chars: need.chars }, { stages });
  assert.strictEqual(g2.stageKey, stages[1].key);
  // adjust 로 다른 고양이의 경험치를 만든다
  const g3 = growth.computeGrowth(0, usage, () => 5000, {}, { stages, adjust: -5000 });
  assert.strictEqual(g3.xp, 0);
  assert.strictEqual(g3.level, 1);
});

/* ── 만남 ── */

test('triggers: 조건을 넘으면 한 번만 표가 생기고, 표는 며칠 안에 만날 날이 정해진다', () => {
  let s = C.seed({ correct: 0 });
  const quiet = { chars: 0, correct: 0, links: 0, tidy: 0, streak: 0, night: false, weekend: false, notesToday: 0, bigNotes: 0, allClear: false };
  let r = C.checkTriggers(s, quiet, 100, () => 0.1);
  assert.strictEqual(r.state.tickets.length, 0);
  r = C.checkTriggers(s, { ...quiet, chars: 1e9, correct: 1e9 }, 100, () => 0.1);
  assert.ok(r.state.tickets.length >= 2);
  for (const t of r.state.tickets) assert.ok(t.due >= 100 && t.due <= 103, JSON.stringify(t));
  const again = C.checkTriggers(r.state, { ...quiet, chars: 1e9, correct: 1e9 }, 101, () => 0.5);
  assert.strictEqual(again.state.tickets.length, r.state.tickets.length, '같은 조건으로 또 생기지 않는다');
});

test('rollDaily: 하루 한 번만 굴리고, 아주 드물게 표가 생긴다', () => {
  const s = C.seed({ correct: 0 });
  const miss = C.rollDaily(s, 50, () => 0.99);
  assert.strictEqual(miss.tickets.length, 0);
  assert.strictEqual(miss.rolled, 50);
  const hit = C.rollDaily(s, 50, () => 0);
  assert.strictEqual(hit.tickets.length, 1);
  assert.strictEqual(C.rollDaily(hit, 50, () => 0).tickets.length, 1, '같은 날은 다시 안 굴린다');
});

test('pickBreed: 이미 데려온 품종은 안 나오고, 귀한 품종은 몇 마리 모은 뒤에야, 다 모으면 null', () => {
  let s = C.seed({ correct: 0 });
  for (let i = 0; i < 50; i++) {
    const k = C.pickBreed(s, Math.random);
    assert.ok(k && k !== 'cheese');
    assert.notStrictEqual(breedOf(k).rarity, 'rare', '처음엔 귀한 품종이 안 나온다');
  }
  for (const b of BREEDS) s = C.adopt(s, b.key, { raw: 0, chars: 0, now: 1 });
  assert.strictEqual(C.pickBreed(s, Math.random), null);
});

test('stray: 표가 있는 날에만 나타나고, 표 하나를 쓰고, 처음 본 품종을 기록, 15분 뒤 떠난다', () => {
  let s = C.seed({ correct: 0 });
  s = { ...s, tickets: [{ due: 10, why: 'x' }] };
  assert.strictEqual(C.ticketDue(s, 9), false);
  assert.strictEqual(C.ticketDue(s, 10), true);
  s = C.startStray(s, 'owl', 10, 1000);
  assert.strictEqual(s.tickets.length, 0);
  assert.strictEqual(s.stray.breed, 'owl');
  assert.ok(s.seen.owl === 1000);
  assert.strictEqual(C.strayHere(s, 1000 + 14 * 60_000), true);
  assert.strictEqual(C.strayHere(s, 1000 + 16 * 60_000), false);
  assert.strictEqual(C.endStray(s).stray, null);
});

/* ── 길들이기 ── */

test('tameChance: 맞힐수록 · 좋은 걸 줄수록 올라가고, 귀한 품종은 더 어렵고, 늘 5%~90%', () => {
  const p = (correct, price, rarity = 'common') => C.tameChance({ correct, price, rarity });
  assert.ok(p(1, 15) > p(0, 15));
  assert.ok(p(3, 15) > p(2, 15));
  assert.ok(p(1, 300) > p(1, 15));
  assert.ok(p(2, 60, 'rare') < p(2, 60, 'common'));
  for (const c of [0, 1, 2, 3]) for (const pr of [0, 5, 60, 2000]) for (const r of ['common', 'rare']) {
    const x = p(c, pr, r);
    assert.ok(x >= 0.05 && x <= 0.9, `${c} ${pr} ${r} ${x}`);
  }
});

test('adopt: 데려온 고양이는 지금 경험치를 출발점으로, 0 레벨부터', () => {
  let s = C.seed({ correct: 0 });
  s = C.adopt(s, 'owl', { raw: 777, chars: 50, now: 5 });
  assert.strictEqual(s.cats.owl.base, 777);
  assert.strictEqual(C.catXp(s, 'owl', 900), 0, '쉬는 동안은 안 자란다');
  assert.strictEqual(s.cats.owl.correct, 0);
  assert.ok(C.caught(s).includes('owl'));
});

test('switchTo · adopt: 프로토타입 이름(constructor)은 고양이가 아니다', () => {
  let s = C.seed({ correct: 0 });
  assert.strictEqual(C.switchTo(s, 'constructor', { raw: 0, chars: 0 }), s);
  assert.strictEqual(C.switchTo(s, 'toString', { raw: 0, chars: 0 }), s);
  assert.strictEqual(C.adopt(s, '__proto__', { raw: 0, chars: 0, now: 1 }), s);
});

test('switchTo: 경험치가 줄어도(폴더 빼기) 쉬는 고양이 경험치 · 글자는 0 아래로 안 간다', () => {
  let s = C.seed({ correct: 0 });
  s = C.adopt(s, 'puff', { raw: 500, chars: 500, now: 1 });
  s = C.switchTo(s, 'puff', { raw: 500, chars: 500 });
  s = C.switchTo(s, 'cheese', { raw: 100, chars: 100 });
  assert.strictEqual(s.cats.puff.frozen, 0);
  assert.strictEqual(s.cats.puff.cFrozen, 0);
});

test('triggers: 조건을 넘어도 만남은 확률 (운이 나쁘면 표가 안 생긴다), 조건은 그래도 한 번만', () => {
  const s = C.seed({ correct: 0 });
  const m = { chars: 1e9, correct: 0, links: 0, tidy: 0, streak: 0, night: false, weekend: false, notesToday: 0, bigNotes: 0, allClear: false };
  const r = C.checkTriggers(s, m, 5, () => 0.99);
  assert.ok(r.fired.length > 0);
  assert.strictEqual(r.state.tickets.length, 0);
  assert.strictEqual(C.checkTriggers(r.state, m, 6, () => 0).fired.length, 0);
});

test('triggers: 긴 노트는 설치 뒤에 새로 생긴 것만, 퀘스트 다 깨기도 조건', () => {
  const s = C.seed({ correct: 0 });
  const m = { chars: 0, correct: 0, links: 0, tidy: 0, streak: 0, night: false, weekend: false, notesToday: 0, bigNotes: 4, allClear: false };
  const first = C.checkTriggers(s, m, 1, () => 0);
  assert.ok(!first.fired.includes('bigNote'), '처음 본 긴 노트 수는 기준으로만');
  const more = C.checkTriggers(first.state, { ...m, bigNotes: 5 }, 2, () => 0);
  assert.ok(more.fired.includes('bigNote'));
  assert.ok(C.checkTriggers(s, { ...m, allClear: true }, 1, () => 0).fired.includes('allClear'));
});

test('peak: 진화 바닥은 고양이마다 (다른 고양이 단계가 옮아가지 않는다)', () => {
  let s = C.seed({ correct: 0 });
  s = C.notePeak(s, 2);
  s = C.adopt(s, 'puff', { raw: 0, chars: 0, now: 1 });
  s = C.switchTo(s, 'puff', { raw: 0, chars: 0 });
  assert.strictEqual(C.peakOf(s), 0);
  s = C.switchTo(s, 'cheese', { raw: 0, chars: 0 });
  assert.strictEqual(C.peakOf(s), 2);
  assert.strictEqual(C.notePeak(s, 1).cats.cheese.peak, 2, '내려가지 않는다');
});

(async () => {
  let pass = 0;
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log('✓', t.name);
    } catch (e) {
      console.log('✗', t.name, '\n   ', e.message);
    }
  }
  console.log(`\n${pass} / ${tests.length} passed`);
  if (pass !== tests.length) process.exitCode = 1;
})();
