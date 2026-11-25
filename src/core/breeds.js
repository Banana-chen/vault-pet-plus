'use strict';
// [Plus] 고양이 품종 (모으기). 그림은 kit/breeds.js, 이름은 i18n-plus 'breed.<key>' · 'stage.<key>'.
// 품종마다 생김새(몸 도트 · 꼬리 · 무늬)와 진화 단계 · 조건이 다르다. 조건은 레벨 + 그 품종이 좋아하는 습관.
//  chars 글자 수 · correct 복습에서 맞힌 문제 · links 볼트 링크 수 · nights 밤(22~2시)에 쓴 날 · days 글을 쓴 날
//  dawns 아침(5~9시)에 쓴 날 · focus 끝낸 집중 세션
// 고양이마다 따로 센다 (links 만 볼트 전체). 사용자에게 몇 품종인지는 보여 주지 않는다

const BREEDS = [
  // 처음 고양이. 진화 조건은 Plus 처음 판 그대로
  {
    key: 'cheese', rarity: 'start', fur: 'cheese', ears: 'perk',
    stages: [
      { key: 'cat', need: { level: 1 } },
      { key: 'cat2', need: { level: 15, links: 10, correct: 20 } },
      { key: 'cat3', need: { level: 35, links: 30, correct: 100 } },
    ],
  },
  // 경단: 동글동글 짧은 다리, 솜뭉치 꼬리. 글을 많이 쓰면 자란다
  {
    key: 'puff', rarity: 'common', fur: 'white', ears: 'round',
    stages: [
      { key: 'puff', need: { level: 1 } },
      { key: 'puff2', need: { level: 12, chars: 30_000 } },
      { key: 'puff3', need: { level: 30, chars: 150_000 } },
    ],
  },
  // 책벌레: 둥근 안경 무늬, 접힌 귀. 복습을 맞히면 자란다
  {
    key: 'scholar', rarity: 'common', fur: 'gray', ears: 'fold',
    stages: [
      { key: 'scholar', need: { level: 1 } },
      { key: 'scholar2', need: { level: 12, correct: 30 } },
      { key: 'scholar3', need: { level: 30, correct: 150 } },
    ],
  },
  // 거미줄: 등에 실 무늬, 긴 꼬리. 링크를 이으면 자란다
  {
    key: 'weaver', rarity: 'common', fur: 'black', ears: 'pointy',
    stages: [
      { key: 'weaver', need: { level: 1 } },
      { key: 'weaver2', need: { level: 12, links: 15 } },
      { key: 'weaver3', need: { level: 30, links: 50 } },
    ],
  },
  // 올빼미: 큰 눈, 귀 끝 털, 이마 초승달. 밤에 쓰면 자란다
  {
    key: 'owl', rarity: 'common', fur: 'choco', ears: 'lynx',
    stages: [
      { key: 'owl', need: { level: 1 } },
      { key: 'owl2', need: { level: 12, nights: 5 } },
      { key: 'owl3', need: { level: 30, nights: 20 } },
    ],
  },
  // 달리기: 긴 다리, 뭉툭한 짧은 꼬리, 번개 줄무늬. 매일 쓰면 자란다
  {
    key: 'dash', rarity: 'common', fur: 'ginger', ears: 'outtilt',
    stages: [
      { key: 'dash', need: { level: 1 } },
      { key: 'dash2', need: { level: 12, days: 7 } },
      { key: 'dash3', need: { level: 30, days: 30 } },
    ],
  },
  // 별밤 (귀함): 몸에 별가루, 반짝이는 꼬리 끝. 쓰고 맞히면 자란다
  {
    key: 'star', rarity: 'rare', fur: 'blue', ears: 'small',
    stages: [
      { key: 'star', need: { level: 1 } },
      { key: 'star2', need: { level: 15, chars: 50_000, correct: 50 } },
      { key: 'star3', need: { level: 35, chars: 200_000, correct: 200 } },
    ],
  },
  // 두 꼬리 (귀함): 꼬리가 둘, 여우 귀, 도깨비불. 링크와 밤
  {
    key: 'twin', rarity: 'rare', fur: 'calico', ears: 'fox',
    stages: [
      { key: 'twin', need: { level: 1 } },
      { key: 'twin2', need: { level: 15, links: 20, nights: 10 } },
      { key: 'twin3', need: { level: 35, links: 60, nights: 30 } },
    ],
  },
  // ── 2026-11 새 품종 넷. meet = 이 조건으로 생긴 만남 표일 때 더 잘 나온다 (core/collection.js pickBreed) ──
  // 새싹: 머리에 떡잎, 잎 꼬리. 꾸준히 매일 쓰면 자란다
  {
    key: 'sprout', rarity: 'common', fur: 'mint', ears: 'round', meet: ['streak3', 'streak7', 'streak14', 'weekend'],
    stages: [
      { key: 'sprout', need: { level: 1 } },
      { key: 'sprout2', need: { level: 12, days: 10 } },
      { key: 'sprout3', need: { level: 30, days: 40 } },
    ],
  },
  // 물방울: 이마 물방울, 물고기 꼬리. 긴 글을 많이 쓰면 자란다
  {
    key: 'tide', rarity: 'common', fur: 'silver', ears: 'small', meet: ['chars40k', 'chars60k', 'chars100k', 'bigNote'],
    stages: [
      { key: 'tide', need: { level: 1 } },
      { key: 'tide2', need: { level: 12, chars: 40_000 } },
      { key: 'tide3', need: { level: 30, chars: 180_000 } },
    ],
  },
  // 톱니: 안테나와 볼트. 링크를 정리하고 복습을 맞히면 자란다
  {
    key: 'gear', rarity: 'common', fur: 'cream', ears: 'tnr', meet: ['tidy3', 'tidy8', 'tidy15', 'allClear'],
    stages: [
      { key: 'gear', need: { level: 1 } },
      { key: 'gear2', need: { level: 12, links: 12, correct: 25 } },
      { key: 'gear3', need: { level: 30, links: 40, correct: 120 } },
    ],
  },
  // 아기용 (귀함): 작은 뿔, 화살촉 꼬리. 오래 꾸준히 많이 써야 자란다
  {
    key: 'dragon', rarity: 'rare', fur: 'lilac', ears: 'intilt', meet: ['streak21', 'chars250k', 'correct120', 'links60', 'notes5'],
    stages: [
      { key: 'dragon', need: { level: 1 } },
      { key: 'dragon2', need: { level: 15, chars: 60_000, days: 14 } },
      { key: 'dragon3', need: { level: 35, chars: 250_000, days: 45 } },
    ],
  },
  // ── 2026-11-25 둘 더 ──
  // 종달새: 이마의 작은 해, 깃털 꼬리. 아침에 쓰면 자란다 (올빼미의 반대)
  {
    key: 'lark', rarity: 'common', fur: 'peach', ears: 'whitetip', meet: ['dawn', 'streak3', 'notes3'],
    stages: [
      { key: 'lark', need: { level: 1 } },
      { key: 'lark2', need: { level: 12, dawns: 5 } },
      { key: 'lark3', need: { level: 30, dawns: 20 } },
    ],
  },
  // 모래시계 (귀함): 이마의 모래시계, 잘록한 허리, 추 꼬리. 집중 세션을 끝내고 글을 쓰면 자란다
  {
    key: 'hourglass', rarity: 'rare', fur: 'gold', ears: 'small', meet: ['focus3', 'focus10', 'allClear'],
    stages: [
      { key: 'hourglass', need: { level: 1 } },
      { key: 'hourglass2', need: { level: 15, focus: 8, chars: 40_000 } },
      { key: 'hourglass3', need: { level: 35, focus: 30, chars: 160_000 } },
    ],
  },
];

// 단계 전용 모션 (kit/motions.js 의 이름). 2단계부터, 심심할 때 세트 전용 모션처럼 저절로 섞여 나온다 (plugin/host.js idlePool).
// 첫 것은 진화 직후 한 번 보여 준다. 상점 · 설정에는 안 나온다
const STAGE_MOTIONS = {
  cat2: ['slowblink', 'shinyfur'], cat3: ['aura', 'glowup', 'coronation'],
  puff2: ['bubbleplay'], puff3: ['cloudloop', 'bubbleplay'],
  scholar2: ['dozebook'], scholar3: ['calligraphy', 'examboard', 'dozebook'],
  weaver2: ['webhang'], weaver3: ['spider', 'webhang'],
  owl2: ['slowblink'], owl3: ['starcall', 'slowblink'],
  dash2: ['airpunch'], dash3: ['rocket', 'zoomies'],
  star2: ['starcall'], star3: ['holywings', 'starcall'],
  twin2: ['soul'], twin3: ['ghost', 'soul'],
  sprout2: ['teatime'], sprout3: ['fandance', 'teatime'],
  tide2: ['bath'], tide3: ['bubbleplay', 'bath'],
  gear2: ['recharge'], gear3: ['rocketpunch', 'reboot', 'recharge'],
  dragon2: ['fireup'], dragon3: ['rocket', 'fireup', 'aura'],
  lark2: ['stretch'], lark3: ['glowup', 'hooray', 'stretch'],
  hourglass2: ['tapfoot'], hourglass3: ['coffee', 'aura', 'tapfoot'],
};

const START_BREED = 'cheese';
const breedOf = (key) => BREEDS.find((b) => b.key === key) || null;
// 단계 열쇠 → 품종 (그림 · 이름 찾기)
const breedOfStage = (stageKey) => BREEDS.find((b) => b.stages.some((s) => s.key === stageKey)) || null;

module.exports = { BREEDS, START_BREED, STAGE_MOTIONS, breedOf, breedOfStage };
