// [Plus] 고양이 품종 그림 (core/breeds.js 의 품종 · 단계와 열쇠가 같다).
// sprite.js 의 STAGE 에 단계마다 몸 도트 · 꼬리 · 눈 · 무늬(mark)를 꽂는다.
//  - 몸 도트는 15칸 × 13줄, 맨 위 세 줄(귀)과 꾸미기 기준점(acc)은 원래 고양이와 같다 → 귀 고르기 · 코스튬이 그대로 맞는다
//  - 품종을 가르는 건 몸 윤곽 · 다리 · 꼬리 · 눈 크기와, 털색 위에 늘 그리는 무늬(mark)
//  - 2단계는 특징이 자라고(갈기 · 긴 꼬리 · 무늬 늘기), 3단계는 늘 움직이는 효과가 붙는다
// mark(g, a, t): this = PetRenderer, a = 기준점 (sprite.js 의 anchorsOf), t = 초
(function (root) {
  const S = root.PetSprite;
  if (!S || !S.STAGE) return;
  const base = S.STAGE.cat;
  const EARS3 = base.map.rows.slice(0, 3);
  const per = (t, every, len) => t % every < len;

  // 몸: 귀 세 줄은 원래 것, 나머지 10줄만 품종마다
  const body = (rows10, tail, extra = {}) => ({
    ...base,
    ...extra,
    map: { ...base.map, rows: [...EARS3, ...rows10], tail: tail || base.map.tail, _meta: undefined },
  });
  // 단계: 몸은 같고 꼬리 · 무늬만 바꿀 때
  const grow = (def, tail, mark) => ({ ...def, map: { ...def.map, tail: tail || def.map.tail, _meta: undefined }, mark });
  // 무늬 여럿을 차례로
  const marks = (...fs) =>
    function (g, a, t) {
      for (const f of fs) f.call(this, g, a, t);
    };

  /* ── 공통 무늬 조각 ── */

  // 목 둘레 갈기: 양옆으로 삐친 털과 가슴 털 (흰 털)
  function ruff(g, a) {
    const W = '#fff4e2', O = g.c.outline;
    for (const [x, d] of [[a.left, -1], [a.right, 1]]) {
      this.px(x + d, a.neck - 3, O);
      this.px(x + d, a.neck - 2, W);
      this.px(x + d * 2, a.neck - 2, O);
      this.px(x + d, a.neck - 1, W);
      this.px(x + d * 2, a.neck - 1, W);
      this.px(x + d * 3, a.neck - 1, O);
      this.px(x + d, a.neck, O);
      this.px(x + d * 2, a.neck, O);
    }
    this.pattern(['W.W.W', '.WWW.', '..W..'], a.hx - 2, a.neck - 1, { W });
  }
  // 머리 위에서 반짝이는 점 (3단계 공통 바탕)
  const twinkle = (color, spots) =>
    function (g, a, t) {
      spots.forEach(([dx, dy, ph], k) => {
        const on = Math.sin(t * 3 + ph + k) > 0.2;
        if (on) this.px(a.hx + dx, a.top + dy, color, false);
      });
    };
  // 몸 둘레를 도는 작은 빛 (n 개)
  const orbit = (color, n, r = 10, speed = 1.4) =>
    function (g, a, t) {
      for (let k = 0; k < n; k++) {
        const ang = t * speed + (k * Math.PI * 2) / n;
        const x = a.cx + Math.cos(ang) * r;
        const y = a.cy - 2 + Math.sin(ang) * r * 0.45;
        this.px(x, y, color, false);
        if (Math.sin(ang) > 0) this.px(x + 1, y, color, false);
      }
    };

  /* ── 치즈 (처음 고양이) ── */
  const cheese1 = base;
  const cheese2 = grow(base, null, ruff);
  const cheese3 = grow(base, null, marks(ruff, function (g, a, t) {
    // 머리 위 작은 금빛 왕관이 반짝
    const Y = '#ffd65a', y = '#d9a21f';
    this.pattern(['Y.Y.Y', 'YyYyY'], a.hx - 2, a.top - 3, { Y, y }, false);
    if (per(t, 2.2, 0.3)) this.px(a.hx, a.top - 5, '#ffffff', false);
  }));

  /* ── 경단: 동글동글, 짧은 다리, 솜뭉치 꼬리 ── */
  const puffTail = { x: 13, y: 6, rows: ['.OOO.', 'OLLLO', 'OLLLO', '.OOO.'] };
  const puffTailBig = { x: 13, y: 5, rows: ['.OOO.', 'OLLLO', 'OLLLLO', 'OLLLO', '.OOO.'] };
  const puff1 = body(
    [
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      'OBBBBBBBBBBBBBO',
      'OBBBBBBBBBBBBBO',
      'OBBBBBBBBBBBBBO',
      'OBBBBLLLLLBBBBO',
      'OBBBBLLLLLBBBBO',
      '.OBBBBLLLBBBBO.',
      '..OBBOOOOOBBO..',
      '..OOO.....OOO..',
    ],
    puffTail,
    { eye: { w: 2, h: 2, spread: 3, dy: 0 } },
  );
  // 늘 발그레한 큰 볼
  function puffCheeks(g, a) {
    const P = '#ff9fb2';
    for (const x of [a.eyeL - 3, a.eyeR + a.ew + 1]) this.pattern(['PP', 'PP'], x, a.my, { P });
  }
  // 정수리 솜털 세 가닥
  function puffTuft(g, a, t) {
    const sway = per(t, 3, 0.5) ? 1 : 0;
    this.pattern(['.L.L.', 'LLLLL'], a.hx - 2 + sway, a.top - 2, { L: g.c.light });
  }
  // 둥실 떠다니는 구름 두 조각
  function puffClouds(g, a, t) {
    for (let k = 0; k < 2; k++) {
      const x = a.cx + (k ? 9 : -12) + Math.round(Math.sin(t * 0.8 + k * 2) * 2);
      const y = a.top - 4 + k * 3;
      this.pattern(['.WW.', 'WWWW'], x, y, { W: '#ffffff' }, false);
    }
  }
  const puff2 = grow(puff1, puffTailBig, marks(puffCheeks, puffTuft));
  const puff3 = grow(puff1, puffTailBig, marks(puffCheeks, puffTuft, puffClouds));
  const puffBase = grow(puff1, null, puffCheeks);

  /* ── 책벌레: 둥근 안경, 책갈피 꼬리 ── */
  const scholar1 = body(
    [
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '..OBBBBBBBBBO..',
      '..OBMMMMMMMBO..',
      '..OBMMMMMMMBO..',
      '..OBBMMMMMBBO..',
      '..OBBOOOOOBBO..',
      '.OOOO.....OOOO.',
    ],
    { x: 13, y: 3, rows: ['.OO.', 'OBBO', 'OBBO', 'OBBO', 'OBBO', 'OBBO', '.OO.'] },
    { eye: { w: 1, h: 2, spread: 2, dy: 0 } },
  );
  // 동그란 금테 안경 (눈과 테 사이 한 칸 띄운다) + 콧등 다리
  function glasses(g, a) {
    const Y = '#e2b33c';
    for (const x of [a.eyeL, a.eyeR]) {
      const l = x - 2, r = x + a.ew + 1;
      this.rect(l + 1, a.ey - 2, r - l - 1, 1, Y);
      this.rect(l + 1, a.ey + a.eh + 1, r - l - 1, 1, Y);
      this.rect(l, a.ey - 1, 1, a.eh + 2, Y);
      this.rect(r, a.ey - 1, 1, a.eh + 2, Y);
    }
    this.px(Math.round((a.eyeL + a.eyeR + a.ew) / 2) - 1, a.ey - 1, Y);
  }
  // 이마에 잉크 얼룩 (2단계)
  function inkSpot(g, a) {
    this.pattern(['.K.', 'KKK'], a.hx - 1, a.top + 1, { K: '#3b4a8a' });
  }
  // 머리 위로 글자가 하나씩 떠오른다 (3단계)
  function letters(g, a, t) {
    const glyphs = [['XXX', 'X.X', 'XXX', 'X.X', 'X.X'], ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'], ['.XX', 'X..', 'X..', 'X..', '.XX']];
    const k = Math.floor(t / 1.6) % glyphs.length;
    const p = (t % 1.6) / 1.6;
    const c = p < 0.7 ? '#6f8bff' : '#b9c6ff';
    this.pattern(glyphs[k], a.right + 2, a.top - 2 - Math.round(p * 5), { X: c }, false);
  }
  const scholarBase = grow(scholar1, null, glasses);
  const scholar2 = grow(scholar1, null, marks(glasses, inkSpot));
  const scholar3 = grow(scholar1, null, marks(glasses, inkSpot, letters));

  /* ── 거미줄: 가슴에 흰 거미줄, 길게 늘어진 꼬리 ── */
  function web(g, a) {
    this.pattern(['W...W', '.W.W.', 'WWWWW', '.W.W.', 'W...W'], a.hx - 2, a.neck - 2, { W: '#d7dee8' });
  }
  const weaver1 = body(
    [
      '.OBBBBBSBBBBBO.',
      '.OBBBBBSBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      'OBBBBBBBBBBBBBO',
      'OBBBBBBBBBBBBBO',
      'OBOOOBOOOBOOOBO',
      'OBO.OBO.OBO.OBO',
      'OOO.OOO.OOO.OOO',
    ],
    { x: 13, y: 2, rows: ['.OO.', 'OBBO', 'OBBO', 'OBBO', 'OBBO', 'OBBO', 'OBBO', '.OO.'] },
    { eye: { w: 2, h: 1, spread: 2, dy: 1 } },
  );
  // 꼬리 끝에 매달린 실 한 가닥
  function thread(g, a, t) {
    const W = '#e9eef5';
    const x = a.right + 4 + (per(t, 2, 1) ? 1 : 0);
    for (let j = 0; j < 4; j++) this.px(x, a.top + 1 + j, W, false);
    this.px(x, a.top + 5, '#9aa3b0', false);
  }
  // 몸 둘레로 반짝이는 실 마디들 (3단계)
  function webGlow(g, a, t) {
    for (let k = 0; k < 6; k++) {
      const on = Math.sin(t * 2.5 + k * 1.1) > 0.4;
      if (!on) continue;
      const x = a.left - 3 + ((k * 5) % (a.right - a.left + 7));
      this.px(x, a.top - 2 - (k % 2), '#c9f2ff', false);
    }
  }
  const weaverBase = grow(weaver1, null, web);
  const weaver2 = grow(weaver1, null, marks(web, thread));
  const weaver3 = grow(weaver1, null, marks(web, thread, webGlow));

  /* ── 올빼미: 큰 눈, 이마 초승달 ── */
  const owl1 = body(
    [
      '.OBBBBBBBBBBBO.',
      'OBBBBBBBBBBBBBO',
      'OBBBBBBBBBBBBBO',
      'OBBBBBBBBBBBBBO',
      'OSBBBBBBBBBBBSO',
      'OSSBBBBBBBBBSSO',
      '.OSBBBBBBBBBSO.',
      '..OBBBBBBBBBO..',
      '...OBOOOOOBO...',
      '...OOO...OOO...',
    ],
    { x: 13, y: 4, rows: ['.OO.', 'OBBO', 'OSBO', 'OBBO', 'OSBO', '.OO.'] },
    { eye: { w: 3, h: 3, spread: 2, dy: -1 } },
  );
  function moon(g, a) {
    this.pattern(['.YY', 'Y..', '.YY'], a.hx - 1, a.top, { Y: '#ffd65a' });
  }
  // 가슴 깃털 무늬 (2단계)
  function feathers(g, a) {
    const L = g.c.light;
    this.pattern(['L.L.L', '.L.L.', 'L.L.L'], a.hx - 2, a.neck - 1, { L });
  }
  // 둘레를 도는 작은 별 셋 (3단계)
  const owl2 = grow(owl1, null, marks(moon, feathers));
  const owl3 = grow(owl1, null, marks(moon, feathers, orbit('#fff3a8', 3, 11, 1.1)));
  const owlBase = grow(owl1, null, moon);

  /* ── 달리기: 긴 다리, 뭉툭한 짧은 꼬리, 옆구리 번개 ── */
  const dash1 = body(
    [
      '.OBBBSBSBSBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '..OBBOOOOOBBO..',
      '..OBO.....OBO..',
      '..OBO.....OBO..',
      '..OO......OO...',
    ],
    { x: 13, y: 4, rows: ['.OO.', 'OBBO', '.OO.'] },
    { eye: { w: 2, h: 2, spread: 2, dy: 0 } },
  );
  function bolt(g, a) {
    const Y = '#ffd65a';
    for (const [x, d] of [[a.left + 1, 1], [a.right - 1, -1]]) {
      this.px(x, a.neck - 3, Y);
      this.px(x + d, a.neck - 2, Y);
      this.px(x, a.neck - 1, Y);
    }
  }
  // 뒤로 흐르는 속도선 (2단계)
  function speedLines(g, a, t) {
    const off = Math.floor(t * 8) % 3;
    for (let k = 0; k < 3; k++) this.rect(a.left - 5 - off, a.neck - 4 + k * 2, 3, 1, 'rgba(255,255,255,0.7)');
  }
  // 꼬리 끝 불꽃 (3단계)
  function flame(g, a, t) {
    const f = Math.floor(t * 10) % 2;
    this.pattern(f ? ['.R.', 'RYR', '.Y.'] : ['R.R', '.Y.', 'RYR'], a.right + 3, a.top + 2, { R: '#ff7a2a', Y: '#ffd65a' }, false);
  }
  const dash2 = grow(dash1, null, marks(bolt, speedLines));
  const dash3 = grow(dash1, null, marks(bolt, speedLines, flame));
  const dashBase = grow(dash1, null, bolt);

  /* ── 별밤 (귀함): 몸에 별가루, 반짝이는 꼬리 끝 ── */
  const star1 = body(
    [
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '..OBBBBBBBBBO..',
      '..OBBBBBBBBBO..',
      '...OBBBBBBBO...',
      '...OBBBBBBBO...',
      '...OBOOOOOBO...',
      '....O.....O....',
    ],
    { x: 13, y: 1, rows: ['OOO.', 'OLLO', '..OBO', '..OBO', '.OBBO', 'OBBO', 'OBBO', '.OO.'] },
  );
  const dust = (n) =>
    function (g, a, t) {
      const spots = [[-4, 3], [3, 5], [-2, 7], [4, 8], [-5, 9], [1, 10], [5, 4], [-3, 5]].slice(0, n);
      spots.forEach(([dx, dy], k) => {
        const c = Math.sin(t * 2 + k) > 0.6 ? '#ffffff' : '#ffe98a';
        this.px(a.hx + dx, a.top + dy, c);
      });
    };
  function halo(g, a, t) {
    const c = per(t, 1.2, 0.6) ? '#fff3a8' : '#ffd65a';
    this.rect(a.hx - 3, a.top - 4, 7, 1, c);
    this.px(a.hx - 4, a.top - 3, c, false);
    this.px(a.hx + 4, a.top - 3, c, false);
  }
  const starBase = grow(star1, null, dust(4));
  const star2 = grow(star1, null, dust(8));
  const star3 = grow(star1, null, marks(dust(8), halo, orbit('#ffffff', 2, 12, 2)));

  /* ── 두 꼬리 (귀함): 꼬리가 둘, 도깨비불 ── */
  const twinTail = { x: 13, y: 2, rows: ['O.O.', 'OBOB', 'OBOB', 'OBBO', 'OBBO', 'OBBO', '.OO.'] };
  const twin1 = body(
    [
      '.OBBBCBBBCBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBBBBBBBBO.',
      '.OBBBBLLLBBBBO.',
      '..OBBLLLLLBBO..',
      '..OBBBLLLBBBO..',
      '...OBBBLBBBO...',
      '...OBBOOOBBO...',
      '...OOO...OOO...',
    ],
    twinTail,
    { eye: { w: 2, h: 2, spread: 2, dy: 0 } },
  );
  const wisp = (n) =>
    function (g, a, t) {
      for (let k = 0; k < n; k++) {
        const x = a.right + 3 + k * 4;
        const y = a.top - 1 + Math.round(Math.sin(t * 2 + k * 2) * 2);
        this.pattern(['.B.', 'BWB', '.B.'], x, y, { B: '#6fb0ea', W: '#e6f6ff' }, false);
      }
    };
  // 이마의 붉은 점 둘 (몸 도트 C) 로 알아본다. 2단계부터 도깨비불
  const twin2 = grow(twin1, null, wisp(1));
  const twin3 = grow(twin1, null, marks(wisp(2), orbit('#9fd4ff', 2, 11, -1.3)));

  Object.assign(S.STAGE, {
    cat: cheese1, cat2: cheese2, cat3: cheese3,
    puff: puffBase, puff2, puff3,
    scholar: scholarBase, scholar2, scholar3,
    weaver: weaverBase, weaver2, weaver3,
    owl: owlBase, owl2, owl3,
    dash: dashBase, dash2, dash3,
    star: starBase, star2, star3,
    twin: twin1, twin2, twin3,
  });
  S.STAGES = Object.keys(S.STAGE);
})(window);
