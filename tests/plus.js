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

test('answersOf: 中文(English) 제목은 전체 · 中文 · English 를 다 정답으로', () => {
  assert.deepStrictEqual(review.answersOf('CDP(Chrome DevTools Protocol)'), ['CDP(Chrome DevTools Protocol)', 'CDP', 'Chrome DevTools Protocol']);
  assert.deepStrictEqual(review.answersOf('W3C（World Wide Web Consortium）'), ['W3C（World Wide Web Consortium）', 'W3C', 'World Wide Web Consortium']);
  assert.deepStrictEqual(review.answersOf('CQRS (Command and Query Responsibility Segregation)'), ['CQRS (Command and Query Responsibility Segregation)', 'CQRS', 'Command and Query Responsibility Segregation']);
  assert.deepStrictEqual(review.answersOf('Dead Letter Queue'), ['Dead Letter Queue']);
  // 괄호가 가운데 있으면: 괄호 밖을 이은 이름 · 괄호 안 · 괄호 앞 이름
  assert.deepStrictEqual(review.answersOf('共變數(Covariates)陷阱'), ['共變數(Covariates)陷阱', '共變數陷阱', 'Covariates', '共變數']);
});

test('answersOf: 콜론 · 대시로 나뉜 제목은 앞 · 뒤도 정답, 너무 짧은 앞 이름(분류)은 정답이 아니다', () => {
  assert.deepStrictEqual(review.answersOf('非同步處理的消費模式：Push vs. Pull'), ['非同步處理的消費模式：Push vs. Pull', '非同步處理的消費模式', 'Push vs. Pull']);
  assert.deepStrictEqual(review.answersOf('Kafka: Exactly Once'), ['Kafka: Exactly Once', 'Kafka', 'Exactly Once']);
  assert.deepStrictEqual(review.answersOf('DDD-Single source of truth'), ['DDD-Single source of truth', 'Single source of truth']);
  assert.deepStrictEqual(review.looseOf('DDD-Single source of truth'), ['DDD']);
  // 낱말 안의 붙임표는 나누지 않는다
  assert.deepStrictEqual(review.answersOf('e-mail 驗證'), ['e-mail 驗證']);
  assert.deepStrictEqual(review.looseOf('CDP(Chrome DevTools Protocol)'), []);
  // 대문자 합성어 · 시각은 나누지 않는다
  for (const t of ['UTF-8', 'COVID-19 notes', 'API-first design', 'SQL-injection', '10:30 會議']) assert.deepStrictEqual(review.answersOf(t), [t], t);
  // 세 글자 중국어 이름은 분류가 아니라 정답이다
  assert.deepStrictEqual(review.answersOf('微服務：拆分原則'), ['微服務：拆分原則', '微服務', '拆分原則']);
  // 콜론 앞에 괄호가 있어도 괄호 규칙은 그대로
  assert.ok(review.answersOf('CDP(Chrome DevTools Protocol): intro').includes('CDP'));
});

test('findMentions: 나뉜 제목의 한쪽 이름으로는 링크를 권하지 않는다 (Kafka 마다 링크가 붙지 않게)', () => {
  const notes = [
    { path: 'Kafka: Exactly Once.md', title: 'Kafka: Exactly Once', text: '只處理一次' },
    { path: 'b.md', title: 'b', text: '我們用 Kafka 傳訊息' },
  ];
  assert.deepStrictEqual(tidy.findMentions(notes), []);
});

test('cardOf: 나뉜 제목의 소문자 보통 낱말은 가리지 않는다', () => {
  const c = review.cardOf('DDD-Single source of truth', '每個資料只有一個 source，DDD 裡常提到');
  assert.ok(c.question.includes('source'), c.question);
});

/* ── 카드 ── */

test('cardOf: 나뉜 제목은 앞 · 뒤를 다 가리고, 짧은 분류 이름은 close 로 받는다', () => {
  const c = review.cardOf('非同步處理的消費模式：Push vs. Pull', '非同步處理的消費模式分成 Push vs. Pull 兩種，Push 由 broker 推，Pull 由 consumer 拉');
  assert.ok(!/非同步處理的消費模式|Push|Pull/.test(c.question), c.question);
  assert.strictEqual(review.grade('push vs pull', c.answers, c.loose), 'right');
  assert.strictEqual(review.grade('非同步處理的消費模式', c.answers, c.loose), 'right');
  const d = review.cardOf('DDD-Single source of truth', '每個資料只有一個權威來源，DDD 裡常提到');
  assert.strictEqual(review.grade('SSOT', d.answers, d.loose), 'right');
  assert.strictEqual(review.grade('ddd', d.answers, d.loose), 'close');
  assert.ok(!d.question.includes('DDD'), d.question);
});

test('cardOf: 첫 단락이 문제, 그 안의 정답 글자도 가린다', () => {
  const c = review.cardOf('Juggler協定(Juggler Protocol)', 'Juggler是playwright團隊開發的協定\n它是 CDP 的替代\n\n第二段');
  assert.ok(c);
  assert.ok(!/Juggler/i.test(c.question), c.question);
  assert.ok(c.question.includes(review.BLANK));
  assert.ok(c.question.includes('它是 CDP 的替代'), '첫 단락은 빈 줄까지');
  assert.ok(!c.question.includes('第二段'));
});

test('cardOf: 괄호가 가운데 있는 제목도 앞 이름까지 가린다', () => {
  const c = review.cardOf('共變數(Covariates)陷阱', '坪數是隱藏在背後的共變數，讓人誤會因果');
  assert.ok(!c.question.includes('共變數'), c.question);
  assert.strictEqual(review.grade('covariates', c.answers), 'right');
});

test('cardOf: 여러 낱말 영어 제목의 머리글자도 가린다 (DLQ)', () => {
  const c = review.cardOf('Dead Letter Queue', '失敗任務的回收桶，設置了 DLQ 就能重試');
  assert.ok(!c.question.includes('DLQ'), c.question);
  assert.strictEqual(review.grade('dlq', c.answers), 'right', '머리글자로 답해도 맞다');
  const fe = review.cardOf('Feature Envy', '常見的 code smell，safe 的寫法是把方法搬回資料所在處');
  assert.ok(fe.question.includes('safe'), '두 글자 머리글자는 가리지 않고, 낱말 안은 가리지 않는다');
});

test('cardOf: frontmatter · 제목줄은 건너뛰고, 첫 단락이 없거나 너무 짧으면 카드가 아니다', () => {
  const c = review.cardOf('自噬作用', '---\ntags: [bio]\n---\n# 自噬作用\n\n細胞分解自身成分的過程');
  assert.ok(c && c.question.startsWith('細胞分解'));
  assert.strictEqual(review.cardOf('空白', ''), null);
  assert.strictEqual(review.cardOf('空白', '# 只有標題\n'), null);
  assert.strictEqual(review.cardOf('ABC', 'ABC'), null, '가리고 나면 남는 게 없다');
});

/* ── 형광펜 카드 ── */

test('cardKeys: 제목 카드 하나 + 형광펜마다 하나 (코드 안은 빼고, 같은 말은 한 번)', () => {
  const text = '甲是 ==熔斷器== 的一種\n\n再說一次 ==熔斷器== 和 ==退避==\n```\n==假的==\n```';
  assert.deepStrictEqual(review.cardKeys('a.md', text), ['a.md', 'a.md\n==熔斷器', 'a.md\n==退避']);
  assert.deepStrictEqual(review.parseKey('a.md\n==退避'), { path: 'a.md', highlight: '退避' });
  assert.deepStrictEqual(review.parseKey('a.md'), { path: 'a.md', highlight: null });
});

test('clozeOf: 형광펜이 있는 단락이 문제, 그 말만 가리고 다른 형광펜 표시는 벗긴다', () => {
  const c = review.clozeOf('前言\n\n甲是 ==熔斷器== 的一種，搭配 ==退避== 使用', '熔斷器');
  assert.deepStrictEqual(c.answers, ['熔斷器']);
  assert.strictEqual(c.question, `甲是 ${review.BLANK} 的一種，搭配 退避 使用`);
  assert.strictEqual(review.clozeOf('沒有這個', '熔斷器'), null);
});

test('bites: 빈칸마다 먹힌 원래 글자를 차례로 (답을 보여 줄 때 그 자리에 돌려놓는다)', () => {
  const c = review.cardOf('CDP(Chrome DevTools Protocol)', 'cdp 是 Chrome DevTools Protocol 的縮寫，透過 CDP 控制瀏覽器');
  assert.deepStrictEqual(c.bites, ['cdp', 'Chrome DevTools Protocol', 'CDP']);
  assert.strictEqual(c.kind, 'title', '제목 카드는 먹힌 제목 줄을 그린다');
  assert.strictEqual(c.question.split(review.BLANK).length - 1, c.bites.length);
  const z = review.clozeOf('==退避== 要配 ==退避== 才行', '退避');
  assert.deepStrictEqual(z.bites, ['退避', '退避']);
});

test('renameInDeck: 형광펜 카드도 같이 옮긴다', () => {
  const deck = { 'a.md': { b: 1, due: 3 }, 'a.md\n==x': { b: 2, due: 4 }, 'ab.md': { b: 0, due: 1 } };
  assert.deepStrictEqual(review.renameInDeck(deck, 'a.md', 'z.md'), { 'z.md': { b: 1, due: 3 }, 'z.md\n==x': { b: 2, due: 4 }, 'ab.md': { b: 0, due: 1 } });
  const inFolder = { 'f/a.md': { b: 3, due: 9 }, 'f/a.md\n==x': { b: 1, due: 2 }, 'fx/b.md': { b: 0, due: 1 } };
  assert.deepStrictEqual(review.renameInDeck(inFolder, 'f', 'g'), { 'g/a.md': { b: 3, due: 9 }, 'g/a.md\n==x': { b: 1, due: 2 }, 'fx/b.md': { b: 0, due: 1 } }, '폴더 이름이 바뀌어도 진행도는 그대로');
});

/* ── 채점 ── */

test('grade: 대소문자 · 공백 · 문장부호는 무시, 한두 글자 차이는 close', () => {
  const a = review.answersOf('CDP(Chrome DevTools Protocol)');
  assert.strictEqual(review.grade('cdp', a), 'right');
  assert.strictEqual(review.grade(' chrome devtools-protocol ', a), 'right');
  assert.strictEqual(review.grade('Chrome DevTool Protocol', a), 'close');
  assert.strictEqual(review.grade('WebDriver', a), 'wrong');
  assert.strictEqual(review.grade('', a), 'wrong');
  // 簡繁 한 글자 차이는 close 로 잡힌다
  assert.strictEqual(review.grade('自噬作用', review.answersOf('自噬作用')), 'right');
  assert.strictEqual(review.grade('不可变架构', review.answersOf('不可變架構(Immutable infrastrcture)')), 'close');
});

/* ── 상자 ── */

test('schedule: 맞히면 다음 상자, 틀리면 1번 상자로, 힌트 쓰면 그 자리', () => {
  const today = 100;
  assert.deepStrictEqual(review.schedule({ b: 0, due: today }, 'right', today, false), { b: 1, due: today + 2 });
  assert.deepStrictEqual(review.schedule({ b: 3, due: today }, 'right', today, false), { b: 4, due: today + 16 });
  assert.deepStrictEqual(review.schedule({ b: 4, due: today }, 'right', today, false), { b: 4, due: today + 16 }, '마지막 상자에 머문다');
  assert.deepStrictEqual(review.schedule({ b: 3, due: today }, 'wrong', today, false), { b: 0, due: today + 1 });
  assert.deepStrictEqual(review.schedule({ b: 2, due: today }, 'right', today, true), { b: 2, due: today + 4 });
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

test('xpFor: 맞히면 15, 힌트 쓰고 맞히면 반, 틀리면 0', () => {
  assert.strictEqual(review.xpFor('right', false), 15);
  assert.strictEqual(review.xpFor('right', true), 7);
  assert.strictEqual(review.xpFor('wrong', false), 0);
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
