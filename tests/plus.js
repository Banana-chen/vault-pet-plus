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

test('candidates: 뻔한 카드는 둘까지, 나머지 둘은 우연히 뽑은 카드 (뜻밖의 연결)', () => {
  const many = [N('A', 'A 是 B 也是 C 也是 D', ['#t']), ...['B', 'C', 'D', 'E', 'F', 'G'].map((t) => N(t, t + '。', ['#t']))];
  many.push(N('X', 'x。'), N('Y', 'y。'));
  const list = connect.candidates(many[0], many, {}, () => 0.3, 4);
  assert.strictEqual(list.length, 4);
  assert.strictEqual(list.filter((c) => c.why === 'random').length, 2, list.map((c) => c.why).join());
});

test('dueToday: 밀린 카드 중 이어진 카드가 적은 것(외톨이)부터', () => {
  const deck = { 'hub.md': { b: 0, due: 1 }, 'lonely.md': { b: 0, due: 5 }, 'mid.md': { b: 0, due: 3 } };
  const degree = { 'hub.md': 9, 'mid.md': 2 };
  assert.deepStrictEqual(review.dueToday(deck, 7, 0, 10, degree), ['lonely.md', 'mid.md', 'hub.md']);
  assert.deepStrictEqual(review.dueToday(deck, 7, 0), ['hub.md', 'mid.md', 'lonely.md'], 'degree 가 없으면 예전처럼');
});

test('reasonQuiz: 이유를 적은 링크로만 문제를 내고, 정답은 그 링크가 가리키는 카드', () => {
  const box = [N('Kafka', 'Kafka 是訊息佇列。\n\n- [[背壓]]：消費者拉得慢時自然形成背壓\n- [[盧曼]]\n'), ...BOX.slice(1)];
  const nb = connect.neighborsOf({ 'Kafka.md': { '背壓.md': 1, '盧曼.md': 1 } });
  const quiz = connect.reasonQuiz(box, nb, () => 0.1, 3);
  assert.strictEqual(quiz.length, 1, '이유 없는 [[盧曼]] 은 문제가 아니다');
  const q = quiz[0];
  assert.deepStrictEqual([q.title, q.question, q.answer], ['Kafka', '消費者拉得慢時自然形成背壓', '背壓.md']);
  assert.strictEqual(q.options.length, 4);
  assert.strictEqual(q.options.filter((o) => nb['Kafka.md'].has(o.path)).length, 1, '다른 보기는 이웃이 아니다');
  assert.ok(q.options.every((o) => o.path !== 'Kafka.md'));
});

test('reasonQuiz: 같은 제목이 두 폴더에 있으면 실제로 이어진 쪽이 정답 (Obsidian 이 고른 링크)', () => {
  const at = (p, text) => ({ path: p, title: p.split('/').pop().replace(/\.md$/, ''), text, tags: [] });
  const box = [at('a/Kafka.md', '- [[背壓]]：慢消費者'), at('x/背壓.md', 'x'), at('y/背壓.md', 'y'), ...['b', 'c', 'd', 'e'].map((t) => at(t + '.md', t))];
  const nb = connect.neighborsOf({ 'a/Kafka.md': { 'x/背壓.md': 1 } });
  for (let i = 0; i < 20; i++) {
    const [q] = connect.reasonQuiz(box, nb, Math.random, 1);
    assert.strictEqual(q.answer, 'x/背壓.md');
    assert.ok(!q.options.some((o) => o.path === 'y/背壓.md'), '같은 제목의 다른 카드는 보기에 넣지 않는다');
  }
  // 경로로 적은 링크 [[y/背壓]] 도 그 경로의 카드가 정답
  box[0] = at('a/Kafka.md', '- [[y/背壓]]：路徑連結');
  const nbY = connect.neighborsOf({ 'a/Kafka.md': { 'y/背壓.md': 1 } });
  assert.strictEqual(connect.reasonQuiz(box, nbY, Math.random, 1)[0].answer, 'y/背壓.md');
});

test('reasonsOf: 반각 콜론 · 별칭 · 제목 링크도 읽고, 이유가 빈 줄은 뺀다', () => {
  assert.deepStrictEqual(connect.reasonsOf('- [[背壓|bp]]: 原因\n- [[背壓#h]]：r2\n- [[空]]：  \n- [[無]]'), [
    { target: '背壓', reason: '原因' },
    { target: '背壓', reason: 'r2' },
  ]);
});

test('newCard: 이유로 시작하고 두 카드로 링크, 제목은 파일 이름에 못 쓰는 글자를 뺀 이유', () => {
  assert.deepStrictEqual(connect.newCard('消費者拉得慢時自然形成背壓', 'Kafka', '背壓'), {
    title: '消費者拉得慢時自然形成背壓',
    text: '消費者拉得慢時自然形成背壓\n\n- [[Kafka]]\n- [[背壓]]\n',
  });
  assert.strictEqual(connect.newCard('A/B: why? [x] #tag', 'a', 'b').title, 'A B why x tag');
  assert.strictEqual(connect.newCard('字'.repeat(80), 'a', 'b').title.length, 60, '제목은 60자까지');
  assert.strictEqual(connect.newCard('?:/', 'Kafka', '背壓').title, 'Kafka × 背壓', '남는 글자가 없으면 두 카드 이름');
});

test('freePath: 원래 카드와 같은 폴더, 이름이 겹치면 뒤에 2 · 3', () => {
  assert.strictEqual(connect.freePath('mq', 'Pull', () => false), 'mq/Pull.md');
  assert.strictEqual(connect.freePath('', 'Pull', () => false), 'Pull.md', '볼트 맨 위');
  const taken = new Set(['mq/Pull.md', 'mq/Pull 2.md']);
  assert.strictEqual(connect.freePath('mq', 'Pull', (p) => taken.has(p)), 'mq/Pull 3.md');
});

test('newCard: 제목이 숨김 파일 · 점이나 공백으로 끝나지 않고, 이모지를 반으로 자르지 않는다', () => {
  assert.strictEqual(connect.newCard('..hidden idea. ', 'a', 'b').title, 'hidden idea');
  assert.strictEqual(connect.newCard('😀'.repeat(70), 'a', 'b').title, '😀'.repeat(60));
});

/* ── Plus (옵시디언 쪽): 가짜 볼트로 ── */
const Module = require('module');
class TFile {
  constructor(p, text) {
    this.path = p;
    this.text = text;
    this.basename = p.split('/').pop().replace(/\.md$/, '');
    this.extension = 'md';
    const dir = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '/';
    this.parent = { path: dir };
  }
}
const load = Module._load;
Module._load = function (req, ...rest) {
  return req === 'obsidian' ? { TFile } : load.call(this, req, ...rest);
};
const { Plus } = require(path.join(src, 'plugin/plus'));
Module._load = load;

function fakePlus(paths) {
  const files = new Map(paths.map((p) => [p, new TFile(p, '본문\n')]));
  const st = {};
  const g = { nextNeed: { level: 15, correct: 20 }, have: { correct: 0 } };
  const seen = { baseline: [] };
  const plugin = {
    state: { get: (k) => st[k], set: (o) => Object.assign(st, o) },
    collect: { addCorrect: () => g.have.correct++ },
    pending: new Set(),
    baselineFile: async (f, text) => seen.baseline.push([f.path, text]),
    host: { gamify: { grant: () => {} }, recomputeGrowth: () => {}, growth: g, stageName: () => '공부 고양이' },
    app: {
      vault: {
        getAbstractFileByPath: (p) => files.get(p) || null,
        getMarkdownFiles: () => [...files.values()],
        process: async (f, fn) => (f.text = fn(f.text)),
        create: async (p, text) => {
          if ([...files.keys()].some((k) => k.toLowerCase() === p.toLowerCase())) throw new Error('exists');
          const f = new TFile(p, text);
          files.set(p, f);
          plugin.pending.add(p);
          return f;
        },
      },
      metadataCache: {
        // 같은 이름이 둘 이상이면 경로로 (옵시디언처럼)
        fileToLinktext: (f) => ([...files.values()].filter((x) => x.basename === f.basename).length > 1 ? f.path.replace(/\.md$/, '') : f.basename),
      },
    },
  };
  return { plus: new Plus(plugin), files, seen, plugin };
}

test('Plus.connect: 쓴 줄과 다음 단계까지 남은 수를 돌려주고, countCard 일 때만 이은 카드 +1', async () => {
  const { plus } = fakePlus(['mq/Kafka.md']);
  const a = await plus.connect('mq/Kafka.md', '背壓', '慢消費者', true);
  assert.deepStrictEqual(a, { xp: 20, line: '- [[背壓]]：慢消費者', connectionsLeft: 19, nextStage: '공부 고양이' });
  const b = await plus.connect('mq/Kafka.md', 'Pull', '拉', false);
  assert.strictEqual(b.connectionsLeft, 19, '같은 카드의 두 번째 연결은 세지 않는다');
  assert.strictEqual(plus.review().correct, 1);
  assert.strictEqual(await plus.connect('mq/Kafka.md', 'X', '  ', true), null, '이유가 없으면 잇지 않는다');
});

test('Plus.writeCard: 같은 폴더에, 대소문자만 다른 이름도 피하고, 옵시디언 링크 이름으로 잇고, 지금 글을 기준으로 잡는다', async () => {
  const { plus, files, seen, plugin } = fakePlus(['mq/Kafka.md', 'mq/kafka 背壓.md', 'a/背壓.md', 'b/背壓.md']);
  const f = await plus.writeCard('mq/Kafka.md', 'b/背壓.md', 'Kafka 背壓');
  assert.strictEqual(f.path, 'mq/Kafka 背壓 2.md');
  assert.strictEqual(files.get(f.path).text, 'Kafka 背壓\n\n- [[Kafka]]\n- [[b/背壓]]\n');
  assert.deepStrictEqual(seen.baseline, [[f.path, files.get(f.path).text]], '새 카드의 글은 새로 쓴 글로 세지 않는다');
  assert.ok(!plugin.pending.has(f.path));
  const root = await plus.writeCard('a/背壓.md', 'mq/Kafka.md', '根目錄?');
  assert.strictEqual(root.path, 'a/根目錄.md');
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
