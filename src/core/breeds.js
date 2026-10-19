'use strict';
// [Plus] 고양이 품종 (모으기). 그림은 kit/breeds.js, 이름은 i18n-plus 'breed.<key>' · 'stage.<key>'.
// 품종마다 생김새(몸 도트 · 꼬리 · 무늬)와 진화 단계 · 조건이 다르다. 조건은 레벨 + 그 품종이 좋아하는 습관.
//  chars 글자 수 · correct 복습에서 맞힌 문제 · links 볼트 링크 수 · nights 밤(22~2시)에 쓴 날 · days 글을 쓴 날
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
];

const START_BREED = 'cheese';
const breedOf = (key) => BREEDS.find((b) => b.key === key) || null;
// 단계 열쇠 → 품종 (그림 · 이름 찾기)
const breedOfStage = (stageKey) => BREEDS.find((b) => b.stages.some((s) => s.key === stageKey)) || null;

module.exports = { BREEDS, START_BREED, breedOf, breedOfStage };
