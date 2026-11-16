'use strict';
/*
 * Vault Pet Plus 로직 검사 (복습 카드 · 링크 정리 · 진화 조건).   node tests/plus.js
 */
const path = require('path');
const assert = require('assert');

const src = path.join(__dirname, '..', 'src');
const review = require(path.join(src, 'core/review'));
const tidy = require(path.join(src, 'core/tidy'));
const growth = require(path.join(src, 'core/growth'));

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

/* ── 제목 → 정답 ── */

test('findMentions: 나뉜 제목의 한쪽 이름으로는 링크를 권하지 않는다 (Kafka 마다 링크가 붙지 않게)', () => {
  const notes = [
    { path: 'Kafka: Exactly Once.md', title: 'Kafka: Exactly Once', text: '只處理一次' },
    { path: 'b.md', title: 'b', text: '我們用 Kafka 傳訊息' },
  ];
  assert.deepStrictEqual(tidy.findMentions(notes), []);
});

test('syncDeck: 처음엔 전부 오늘, 나중에 생긴 노트는 내일부터, 사라진 노트는 뺀다', () => {
  const first = review.syncDeck({}, ['a.md', 'b.md'], 10, true);
  assert.deepStrictEqual(first, { 'a.md': { b: 0, due: 10 }, 'b.md': { b: 0, due: 10 } });
  const later = review.syncDeck({ ...first, 'a.md': { b: 2, due: 14 } }, ['a.md', 'c.md'], 11, false);
  assert.deepStrictEqual(later, { 'a.md': { b: 2, due: 14 }, 'c.md': { b: 0, due: 12 } });
  assert.notStrictEqual(later, first, '새 객체를 돌려준다');
});

test('dueToday: 오늘까지인 카드만, 오래 밀린 것부터, 하루 10장까지 (오늘 푼 만큼 뺀다)', () => {
  const deck = {};
  for (let i = 0; i < 15; i++) deck[`n${i}.md`] = { b: 0, due: 5 + (i % 3) };
  deck['future.md'] = { b: 1, due: 99 };
  const due = review.dueToday(deck, 7, 0);
  assert.strictEqual(due.length, 10);
  assert.ok(!due.includes('future.md'));
  assert.strictEqual(deck[due[0]].due, 5);
  assert.strictEqual(review.dueToday(deck, 7, 8).length, 2);
});

test('dayNum: 같은 날은 같은 수, 다음 날은 +1 (현지 시각 기준)', () => {
  const a = new Date(2026, 9, 19, 0, 5);
  const b = new Date(2026, 9, 19, 23, 55);
  const c = new Date(2026, 9, 20, 0, 5);
  assert.strictEqual(review.dayNum(a), review.dayNum(b));
  assert.strictEqual(review.dayNum(c), review.dayNum(a) + 1);
});

/* ── 링크 정리 ── */

const NOTES = [
  { path: 'Juggler協定(Juggler Protocol).md', title: 'Juggler協定(Juggler Protocol)', text: 'Juggler 是替代 CDP 的協定，比 CDP 更底層' },
  { path: 'CDP(Chrome DevTools Protocol).md', title: 'CDP(Chrome DevTools Protocol)', text: '由 Google 維護，後來 W3C 也有 WebDriver BiDi' },
  { path: 'W3C（World Wide Web Consortium）.md', title: 'W3C（World Wide Web Consortium）', text: '網頁標準組織' },
  { path: 'x.md', title: 'x', text: '```\nCDP in code\n```\n已連 [[CDP(Chrome DevTools Protocol)|CDP]] 了，`CDP` 也不算，CDPX 也不算' },
];

test('schedule: 다시 볼 때마다 다음 상자로, 마지막 상자에서 멈춘다', () => {
  assert.deepStrictEqual(review.schedule({ b: 0, due: 10 }, 10), { b: 1, due: 10 + review.BOX_DAYS[1] });
  const last = review.BOX_DAYS.length - 1;
  assert.deepStrictEqual(review.schedule({ b: last, due: 10 }, 10), { b: last, due: 10 + review.BOX_DAYS[last] });
});

test('renameInDeck: 노트 · 폴더 이름이 바뀌면 카드를 옮긴다', () => {
  const deck = { 'a/x.md': { b: 1, due: 3 }, 'b.md': { b: 0, due: 1 } };
  assert.deepStrictEqual(Object.keys(review.renameInDeck(deck, 'a', 'c')).sort(), ['b.md', 'c/x.md']);
  assert.deepStrictEqual(Object.keys(review.renameInDeck(deck, 'b.md', 'd.md')).sort(), ['a/x.md', 'd.md']);
});

/* ── 카드 잇기 ── */
const connect = require(path.join(src, 'core/connect'));
const N = (title, text, tags = []) => ({ path: title + '.md', title, text, tags });
const BOX = [
  N('Kafka', 'Kafka 是分散式訊息佇列，消費者用 Pull 模式拉訊息。', ['#mq']),
  N('Pull 模式', '消費者自己決定何時取資料。', ['#mq']),
  N('背壓', '下游處理不過來時，往上游回報放慢速度。', ['#flow']),
  N('盧曼', '卡片盒筆記法的發明者。', []),
  N('事件溯源', '把狀態的每次改變存成事件。[[Kafka]] 常拿來當事件日誌。', []),
  N('貓', '貓是一種動物。', []),
];
const NB = connect.neighborsOf({ '事件溯源.md': { 'Kafka.md': 1 }, 'Kafka.md': { 'Kafka.md': 2 } });

test('neighborsOf: 링크는 양쪽 다 이웃, 자기 자신은 뺀다', () => {
  assert.deepStrictEqual([...NB['Kafka.md']], ['事件溯源.md']);
  assert.deepStrictEqual([...NB['事件溯源.md']], ['Kafka.md']);
});

test('candidates: 이미 이어진 카드 · 자기 자신은 빼고, 서로 언급 > 같은 태그, 우연한 한 장도 넣는다', () => {
  const list = connect.candidates(BOX[0], BOX, NB, () => 0.3, 4);
  const paths = list.map((c) => c.path);
  assert.ok(!paths.includes('Kafka.md') && !paths.includes('事件溯源.md'), paths.join());
  assert.strictEqual(list[0].path, 'Pull 模式.md');
  assert.strictEqual(list[0].why, 'mention');
  assert.ok(list.some((c) => c.why === 'random'), '우연히 뽑은 카드');
  assert.ok(list.length <= 4 && new Set(paths).size === paths.length);
  // 같은 이웃(둘 다 Kafka 와 이어짐) · 같은 태그도 이유가 된다
  const nb2 = connect.neighborsOf({ '事件溯源.md': { 'Kafka.md': 1 }, '背壓.md': { 'Kafka.md': 1 } });
  const viaNb = connect.candidates(BOX[2], BOX, nb2, () => 0.3, 4).find((c) => c.path === '事件溯源.md');
  assert.strictEqual(viaNb.why, 'neighbor');
  assert.strictEqual(viaNb.via, 'Kafka');
  const tagged = connect.candidates(BOX[1], [BOX[1], N('RabbitMQ', '另一種訊息佇列。', ['#mq'])], {}, () => 0.3, 4);
  assert.deepStrictEqual([tagged[0].why, tagged[0].via], ['tag', '#mq']);
  // 다시 뽑기: 이미 본 후보는 뺀다
  const more = connect.candidates(BOX[0], BOX, NB, () => 0.3, 4, paths);
  assert.ok(more.every((c) => !paths.includes(c.path)));
});

test('neighborQuiz: 이웃이 있는 카드만 문제가 되고, 정답은 실제 이웃 하나 · 나머지 보기는 이웃이 아니다', () => {
  const quiz = connect.neighborQuiz(BOX, NB, Math.random, 3);
  assert.strictEqual(quiz.length, 2, '이웃이 있는 카드는 둘뿐');
  for (const q of quiz) {
    assert.strictEqual(q.options.length, 4);
    assert.ok(NB[q.path].has(q.answer));
    assert.strictEqual(q.options.filter((o) => NB[q.path].has(o.path)).length, 1);
    assert.ok(q.options.every((o) => o.path !== q.path));
  }
  assert.deepStrictEqual(connect.neighborQuiz(BOX.slice(0, 3), NB), [], '보기가 모자라면 문제를 내지 않는다');
});

test('appendLink: 노트 끝에 링크와 이유 한 줄, 이미 이어져 있으면 null, 링크 목록 뒤에는 바로 붙인다', () => {
  assert.strictEqual(connect.appendLink('본문\n', '背壓', '都在談流量控制'), '본문\n\n- [[背壓]]：都在談流量控制\n');
  assert.strictEqual(connect.appendLink('본문\n\n- [[背壓]]：a\n', 'Kafka', ''), '본문\n\n- [[背壓]]：a\n- [[Kafka]]\n');
  assert.strictEqual(connect.appendLink('看 [[背壓|這張]]', '背壓', 'x'), null);
  assert.strictEqual(connect.appendLink('看 [[背壓]]', '背壓'), null);
  assert.strictEqual(connect.appendLink('', 'Kafka', ' 多行\n理由 '), '- [[Kafka]]：多行 理由\n');
});

test('findMentions: 다른 노트 제목이 나오면 노트마다 대상마다 처음 한 곳만', () => {
  const m = tidy.findMentions(NOTES);
  const pairs = m.map((x) => `${x.path} -> ${x.target}`);
  assert.deepStrictEqual(pairs.sort(), ['CDP(Chrome DevTools Protocol).md -> W3C（World Wide Web Consortium）', 'Juggler協定(Juggler Protocol).md -> CDP(Chrome DevTools Protocol)'].sort());
  const j = m.find((x) => x.path.startsWith('Juggler'));
  assert.strictEqual(j.alias, 'CDP');
  assert.strictEqual(NOTES[0].text.indexOf('CDP'), j.index);
  assert.ok(j.before.includes('CDP') && j.after.includes('[[CDP(Chrome DevTools Protocol)|CDP]]'));
});

test('findMentions: 이미 링크한 대상 · 코드 · 단어 일부 · 자기 자신은 건너뛴다', () => {
  const m = tidy.findMentions(NOTES);
  assert.ok(!m.some((x) => x.path === 'x.md'));
  assert.ok(!m.some((x) => x.path === x.target + '.md'));
});

test('findMentions: 링크할 수 없는 글자가 든 제목 · 너무 짧은 이름은 대상이 아니다', () => {
  const notes = [
    { path: 'a.md', title: 'A|B', text: 'A|B 와 IO 이야기' },
    { path: 'IO.md', title: 'IO', text: '입출력' },
    { path: 'b.md', title: 'b', text: 'A|B 와 IO' },
  ];
  assert.deepStrictEqual(tidy.findMentions(notes), []);
});

test('applyLink: 그 자리를 [[제목|원래 글자]] 로, 글이 바뀌었으면 null', () => {
  const [j] = tidy.findMentions([NOTES[0], NOTES[1]]);
  const out = tidy.applyLink(NOTES[0].text, j);
  assert.strictEqual(out, 'Juggler 是替代 [[CDP(Chrome DevTools Protocol)|CDP]] 的協定，比 CDP 更底層');
  assert.strictEqual(tidy.applyLink('完全不同的內容', j), null);
  const self = { ...j, alias: j.target };
  assert.strictEqual(tidy.applyLink('x ' + j.target, { ...self, index: 2 }), `x [[${j.target}]]`);
});

/* ── 진화 ── */

test('breeds: 단계 전용 모션은 2단계부터 품종마다 있고, 이름이 kit/motions.js 에 다 있다', () => {
  const fs = require('fs');
  const { BREEDS, STAGE_MOTIONS } = require(path.join(src, 'core/breeds'));
  const motionsSrc = fs.readFileSync(path.join(src, 'kit/motions.js'), 'utf8');
  for (const b of BREEDS) {
    assert.ok(!STAGE_MOTIONS[b.stages[0].key], `${b.key}: 1단계에는 전용 모션이 없다`);
    for (const s of b.stages.slice(1)) {
      const list = STAGE_MOTIONS[s.key];
      assert.ok(Array.isArray(list) && list.length, `${s.key}: 전용 모션`);
      for (const m of list) assert.ok(motionsSrc.includes(`\n    ${m}: {`), `${s.key}: 모션 ${m} 이 kit/motions.js 에 없다`);
    }
  }
  const known = new Set(BREEDS.flatMap((b) => b.stages.map((s) => s.key)));
  for (const k of Object.keys(STAGE_MOTIONS)) assert.ok(known.has(k), `모르는 단계 ${k}`);
});

test('growth: 진화는 레벨 · 링크 · 맞힌 문제를 다 채워야 한다', () => {
  const usage = { totals: () => ({ c: 0, l: 0, n: 0, s: 0 }) };
  const xpLv = (lv) => 25 * (lv - 1) ** 2;
  const g = (lv, links, correct) => growth.computeGrowth(0, usage, () => xpLv(lv), { links, correct });
  assert.strictEqual(g(14, 99, 99).stageIndex, 0, '레벨이 모자라다');
  assert.strictEqual(g(15, 9, 20).stageIndex, 0, '링크가 모자라다');
  assert.strictEqual(g(15, 10, 19).stageIndex, 0, '맞힌 문제가 모자라다');
  assert.strictEqual(g(15, 10, 20).stageIndex, 1);
  assert.strictEqual(g(35, 30, 100).stageIndex, 2);
  assert.strictEqual(g(80, 29, 999).stageIndex, 1);
  const n = g(15, 10, 20).nextNeed;
  assert.deepStrictEqual(n, { level: 35, links: 30, correct: 100 });
  assert.strictEqual(g(35, 30, 100).nextNeed, null);
  assert.strictEqual(growth.computeGrowth(0, usage, () => 0).stageIndex, 0, '습관 자료가 없으면 첫 단계');
  assert.strictEqual(growth.computeGrowth(0, usage, () => xpLv(15), { links: 0, correct: 0, floor: 1 }).stageIndex, 1, '링크를 지워도 퇴화하지 않는다');
});

/* ── 실행 ── */

(async () => {
  let pass = 0;
  for (const t of tests) {
    try {
      await t.fn();
      pass++;
      console.log('✓', t.name);
    } catch (e) {
      console.log('✗', t.name);
      console.log('   ', e && e.message);
      process.exitCode = 1;
    }
  }
  console.log(`\n${pass} / ${tests.length} passed`);
})();
