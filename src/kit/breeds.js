// [Plus] 고양이 품종 그림 (core/breeds.js 의 품종 · 단계와 열쇠가 같다).
// sprite.js 의 STAGE 에 단계마다 몸 도트 · 꼬리 · 눈 · 무늬(mark)를 꽂는다.
//  - 몸 도트는 15칸 × 13줄, 맨 위 세 줄(귀)과 꾸미기 기준점(acc)은 원래 고양이와 같다 → 귀 고르기 · 코스튬이 그대로 맞는다
//  - 품종을 가르는 건 몸 윤곽 · 다리 · 꼬리 · 눈 크기와, 털색 위에 늘 그리는 무늬(mark)
//  - 진화하면 다른 형태가 된다: 몸 윤곽 · 꼬리 · 몸 뒤 조각(back) · 무늬(mark)가 단계마다 따로 (아래 '진화 형태'). 전용 모션은 core/breeds.js STAGE_MOTIONS
// mark(g, a, t) · back(g, a, t): this = PetRenderer, a = 기준점 (sprite.js 의 anchorsOf), t = 초
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

  /* ══ 진화 형태 ══
   * 단계마다 다른 생물로 바뀐다: 몸 윤곽(rows) · 꼬리 · 몸 뒤에 그리는 것(back: 날개 · 다리 · 후광) · 몸 위 무늬(mark).
   * 목(acc.neck) 위는 머리라서 귀 · 코스튬 기준점은 그대로 두고, 목 아래로 몸통이 생긴다 (2단계 +1줄, 3단계 +2줄).
   */
  const mir = (rows) => rows.map((r) => r.split('').reverse().join(''));
  const form = (rows, tail, o = {}) => {
    const n = rows.length - 10;
    return { ...base, ...o, map: { ...base.map, rows: [...EARS3, ...rows], tail: tail || base.map.tail, cy: base.map.cy + n / 2, ry: base.map.ry + n / 2, _meta: undefined } };
  };
  const GOLD = '#ffd65a', WHITE = '#fff4e2';
  // 잘 때(몸을 만다)는 큰 조각을 안 그린다
  const awake = (f) => function (g, a, t) { if (!a.curled) f.call(this, g, a, t); };
  // 등 뒤 날개 한 쌍 (천천히 퍼덕인다)
  const WING = ['...OOO..', '..OWWWO.', '.OWWWWWO', 'OWWSWWWO', 'OWWWSWWO', '.OWWWWO.', '.OWOWOO.', '..O.O...'];
  const wings = (colors) => awake(function (g, a, t) {
    const m = colors(g), up = per(t, 1.6, 0.8) ? 0 : 1;
    this.pattern(WING, a.right - 1, a.neck - 9 + up, m, false);
    this.pattern(mir(WING), a.left - 6, a.neck - 9 + up, m, false);
  });

  /* ── 치즈: 고양이 → 공부 고양이(목도리 · 갈기 볼 · 줄무늬 꼬리) → 현자(수염 · 이마 보석 · 후광 · 도포) ── */
  const cheese1 = base;
  const HEAD_CAT = ['.OBBBSBSBSBBBO.', '.OBBBBBSBBBBBO.', '.OBBBBBBBBBBBO.'];
  const cheese2 = form(
    [...HEAD_CAT, 'OOBBBBBBBBBBBOO', 'OLBBBBBBBBBBBLO', '.OLBBBBBBBBBLO.', '..OBBBBBBBBBO..', '.OBBBMMMMMBBBO.', '.OBBBMMMMMBBBO.', '.OBBOOBBBOOBBO.', '..OO..OOO..OO..'],
    { x: 13, y: 3, rows: ['.OOO.', 'OLLLO', 'OBBBO', 'OSSSO', 'OBBBO', 'OSSSO', 'OBBO.', '.OO..'] },
    {
      mark: awake(function (g, a, t) {
        const R = '#e0453a', r = '#b0302a';
        this.rect(a.left + 1, a.neck, 11, 1, R);
        this.rect(a.left + 3, a.neck + 1, 2, 1, r);
        const f = per(t, 1.4, 0.7) ? 0 : 1;
        this.pattern(f ? ['RR.', '.RR', '..R'] : ['RR.', '.R.', '.RR'], a.left - 1, a.neck, { R }, false);
        // 귀 뒤에 꽂은 연필
        this.pattern(['..Y', '.Y.', 'K..'], a.right - 2, a.top - 1, { Y: GOLD, K: '#5a4632' }, false);
      }),
    },
  );
  const cheese3 = form(
    [...HEAD_CAT, 'OOBBBBBBBBBBBOO', 'OLBBBBBBBBBBBLO', 'OLLBBBBBBBBBLLO', '.OOBBBBBBBBBOO.', '.OBBBBMMMBBBBO.', 'OBBBBBMMMBBBBBO', 'OBBSBBMMMBBSBBO', 'OBBOOOBBBOOOBBO', '.OO...OOO...OO.'],
    { x: 13, y: 1, rows: ['..OOO.', '.OLLLO', 'OLLLLO', 'OLLBBO', 'OBBBBO', 'OBBBBO', 'OBBBO.', 'OBBBO.', 'OBBO..', 'OBBO..', '.OO...'] },
    {
      sparkle: '#fffbe0',
      // 머리 뒤에서 도는 금빛 후광
      back: awake(function (g, a, t) {
        for (let k = 0; k < 14; k++) {
          const ang = t * 0.6 + (k * Math.PI * 2) / 14;
          this.px(a.hx + Math.cos(ang) * 10.5, a.top + 4 + Math.sin(ang) * 9.5, k % 2 ? GOLD : '#fff3a8', false);
        }
      }),
      mark: marks(awake(function (g, a, t) {
        const W = '#ffffff';
        // 이마의 보석, 길게 늘어진 흰 눈썹, 가슴까지 오는 수염
        this.pattern(['.C.', 'CWC', '.C.'], a.hx - 1, a.top + 1, { C: '#35c3dd', W });
        this.rect(a.eyeL - 1, a.ey - 2, a.ew + 1, 1, W);
        this.px(a.eyeL - 2, a.ey - 1, W);
        this.px(a.eyeL - 2, a.ey, W);
        this.rect(a.eyeR, a.ey - 2, a.ew + 1, 1, W);
        this.px(a.eyeR + a.ew + 1, a.ey - 1, W);
        this.px(a.eyeR + a.ew + 1, a.ey, W);
        this.pattern(['W.....W', 'WW...WW', '.WWWWW.', '.WWWWW.', '..WWW..', '..WWW..', '...W...'], a.hx - 3, a.my + 1, { W });
      }), orbit('#9ff0ff', 3, 13, 1.1)),
    },
  );

  /* ── 경단: 경단 → 눈뭉치(얼음 결정 · 눈송이) → 구름(구름을 타고 무지개를 진다) ── */
  const puffTail = { x: 13, y: 6, rows: ['.OOO.', 'OLLLO', 'OLLLO', '.OOO.'] };
  const puff1 = body(
    ['.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OBBBBLLLLLBBBBO', 'OBBBBLLLLLBBBBO', '.OBBBBLLLBBBBO.', '..OBBOOOOOBBO..', '..OOO.....OOO..'],
    puffTail,
    { eye: { w: 2, h: 2, spread: 3, dy: 0 } },
  );
  function puffCheeks(g, a) {
    const P = '#ff9fb2';
    for (const x of [a.eyeL - 3, a.eyeR + a.ew + 1]) this.pattern(['PP', 'PP'], x, a.my, { P });
  }
  function puffTuft(g, a, t) {
    const sway = per(t, 3, 0.5) ? 1 : 0;
    this.pattern(['.L.L.', 'LLLLL'], a.hx - 2 + sway, a.top - 2, { L: g.c.light });
  }
  const puffBase = grow(puff1, null, puffCheeks);
  const PUFF_E = { eye: { w: 2, h: 2, spread: 3, dy: 0 } };
  const BALL = ['.OBBBBBBBBBBBO.', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OBBBLLLLLLLBBBO', 'OBBLLLLLLLLLBBO'];
  const ICE = { I: '#d4f1ff', i: '#7cc4f2', O: '#4b8fc0' };
  const SHARD = ['..O.', '.OIO', '.OIO', 'OIiO', 'OIiO', 'OiiO'];
  const puff2 = form(
    [...BALL, '.OBBLLLLLLLBBO.', '..OBBOOOOOBBO..', '...OO.....OO...'],
    { x: 13, y: 6, rows: ['.OOO.', 'OLLLO', 'OLLLLO', 'OLLLLO', 'OLLLO', '.OOO.'] },
    {
      ...PUFF_E,
      // 등 뒤로 솟은 얼음 결정
      back: awake(function (g, a) {
        this.pattern(SHARD, a.right - 1, a.top - 3, ICE, false);
        this.pattern(mir(SHARD), a.left - 2, a.top - 3, ICE, false);
        this.pattern(SHARD.slice(1), a.right + 2, a.top + 2, ICE, false);
        this.pattern(mir(SHARD.slice(1)), a.left - 5, a.top + 2, ICE, false);
      }),
      mark: marks(puffCheeks, awake(function (g, a, t) {
        const B = '#5fb4ee';
        this.pattern(['B.B.B', '.BBB.', 'BBBBB', '.BBB.', 'B.B.B'], a.hx - 2, a.top, { B });
        this.pattern(['I.I.I.I.I.I', 'IIIIIIIIIII'], a.left + 1, a.neck - 1, { I: '#a8dcff' });
        for (let k = 0; k < 6; k++) {
          const x = a.cx - 14 + k * 6 + Math.round(Math.sin(t + k) * 1.5);
          const y = a.top - 8 + ((t * 5 + k * 9) % 24);
          this.px(x, y, k % 2 ? '#a8dcff' : '#ffffff', false);
        }
      })),
    },
  );
  const puff3 = form(
    [...BALL, 'OBBLLLLLLLLLBBO', '.OBBLLLLLLLBBO.', '..OBBOOOOOBBO..', '...OO.....OO...'],
    { x: 13, y: 7, rows: ['.OO.OO.', 'OLLOLLO', 'OLLLLLO', '.OLLLO.', '..OOO..'] },
    {
      ...PUFF_E,
      sparkle: '#ffffff',
      // 머리 뒤 무지개
      back: awake(function (g, a) {
        const C = ['#ff6b6b', '#ffd43b', '#74c0fc'];
        C.forEach((c, k) => {
          const r = 12 - k;
          for (let d = 0; d <= 40; d++) {
            const ang = Math.PI + (d * Math.PI) / 40;
            this.px(a.hx + Math.cos(ang) * r, a.top + 5 + Math.sin(ang) * r, c, false);
          }
        });
      }),
      mark: marks(puffCheeks, puffTuft, awake(function (g, a, t) {
        // 타고 다니는 구름 (발을 덮는다) 과 둥실 떠다니는 조각구름
        const W = '#ffffff', S = '#cfe0ee', O = '#9db7cf';
        const bob = per(t, 2.4, 1.2) ? 0 : 1;
        this.pattern(['..OOO....OOOO...OO...', '.OWWWO..OWWWWO.OWWO..', 'OWWWWWOOWWWWWWOWWWWO.', 'OWWWWWWWWWWWWWWWWWWWO', '.OSSSSSSSSSSSSSSSSSO.', '..OOOOOOOOOOOOOOOOO..'], a.cx - 10, a.ground - 4 + bob, { W, S, O }, false);
        for (let k = 0; k < 2; k++) {
          const x = a.cx + (k ? 11 : -16) + Math.round(Math.sin(t * 0.8 + k * 2) * 2);
          this.pattern(['.OOO.', 'OWWWO', '.OOO.'], x, a.top - 5 + k * 4, { W, O }, false);
        }
      })),
    },
  );

  /* ── 책벌레: 책벌레 → 먹물(붓 꼬리 · 먹 묻은 발 · 두루마리) → 박사(콧수염 · 나비넥타이 · 깃펜 꼬리 · 떠 있는 책) ── */
  const scholar1 = body(
    ['.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '..OBBBBBBBBBO..', '..OBMMMMMMMBO..', '..OBMMMMMMMBO..', '..OBBMMMMMBBO..', '..OBBOOOOOBBO..', '.OOOO.....OOOO.'],
    { x: 13, y: 3, rows: ['.OO.', 'OBBO', 'OBBO', 'OBBO', 'OBBO', 'OBBO', '.OO.'] },
    { eye: { w: 1, h: 2, spread: 2, dy: 0 } },
  );
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
  function letters(g, a, t) {
    const glyphs = [['XXX', 'X.X', 'XXX', 'X.X', 'X.X'], ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'], ['.XX', 'X..', 'X..', 'X..', '.XX']];
    const k = Math.floor(t / 1.6) % glyphs.length;
    const p = (t % 1.6) / 1.6;
    this.pattern(glyphs[k], a.right + 4, a.top - 4 - Math.round(p * 5), { X: p < 0.7 ? '#6f8bff' : '#b9c6ff' }, false);
  }
  const scholarBase = grow(scholar1, null, glasses);
  const SCH_E = { eye: { w: 1, h: 2, spread: 2, dy: 0 } };
  const SCH_HEAD = ['.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '..OBBBBBBBBBO..', '..OBMMMMMMMBO..', '...OMMMMMMMO...', '..OBBMMMMMBBO..'];
  const INK = '#2b3566';
  const scholar2 = form(
    [...SCH_HEAD, '..OBBBMMMBBBO..', '..OSSOOOOOSSO..', '.OOOO.....OOOO.'],
    // 붓 꼬리: 먹 묻은 붓털이 위로
    { x: 13, y: 2, rows: ['..O..', '.OSO.', '.OSO.', 'OSSSO', 'OSSSO', '.OLO.', '.OBO.', '.OBO.', '.OBO.', '..O..'] },
    {
      ...SCH_E,
      // 등에 멘 두루마리
      back: awake(function (g, a) {
        this.pattern(['.OO.....', 'OPPO....', 'OPRPO...', '.OPPPO..', '..OPPPO.'], a.left - 4, a.top - 2, { O: g.c.outline, P: '#f3e2b8', R: '#c0392b' }, false);
      }),
      mark: marks(glasses, awake(function (g, a, t) {
        // 이마의 먹 붓자국, 발밑에 떨어지는 먹물
        this.pattern(['K...K', '.KKK.', '..K..'], a.hx - 2, a.top + 1, { K: INK });
        const d = (t * 4) % 6;
        this.px(a.right + 2, a.neck - 2 + d, INK, false);
        this.pattern(['.KK.', 'KKKK'], a.right + 1, a.ground - 1, { K: INK }, false);
      })),
    },
  );
  const scholar3 = form(
    [...SCH_HEAD, '.OBBBSMMMSBBBO.', '.OBBBSMMMSBBBO.', 'OBBBBSMMMSBBBBO', '.OOOO.OOO.OOOO.'],
    // 깃펜 꼬리
    { x: 13, y: 1, rows: ['...OO', '..OLO', '.OLLO', '.OLLO', 'OLLLO', 'OLLO.', 'OLLO.', '.OLO.', '.OBO.', '.OBO.', '..O..'] },
    {
      ...SCH_E,
      sparkle: '#eef2ff',
      mark: marks(glasses, awake(function (g, a, t) {
        const W = '#ffffff';
        // 풍성한 콧수염, 나비넥타이
        this.pattern(['.WWW.WWW.', 'WWW...WWW', 'W.......W'], a.hx - 4, a.my + 2, { W });
        this.pattern(['R...R', 'RRYRR', 'R...R'], a.hx - 2, a.neck, { R: '#c0392b', Y: GOLD });
        // 옆에 떠서 저절로 넘어가는 책
        const bob = Math.round(Math.sin(t * 1.5));
        const flip = per(t, 2.4, 0.3);
        const K = '#3b4a8a', L = '#9fb0e8';
        this.pattern(
          flip ? ['OOOOOOOOOOO', 'OWWWWOWWWWO', 'OWLLWOWWLWO', 'OWWWWOWLLWO', 'OWLLWOWWWWO', '.OOOOOOOOO.'] : ['OOOOO.OOOOO', 'OWWWWOWWWWO', 'OWLLWOWLLWO', 'OWWWWOWWWWO', 'OWLLWOWLLWO', '.OOOOOOOOO.'],
          a.left - 13, a.top + 1 + bob, { O: K, W, L }, false,
        );
      }), letters),
    },
  );

  /* ── 거미줄: 거미줄 → 실타래(거미 다리 한 쌍 · 배 · 겹눈) → 별그물(다리 네 쌍 · 등 뒤 큰 거미줄) ── */
  function web(g, a) {
    this.pattern(['W...W', '.W.W.', 'WWWWW', '.W.W.', 'W...W'], a.hx - 2, a.neck - 2, { W: '#d7dee8' });
  }
  const weaver1 = body(
    ['.OBBBBBSBBBBBO.', '.OBBBBBSBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OBOOOBOOOBOOOBO', 'OBO.OBO.OBO.OBO', 'OOO.OOO.OOO.OOO'],
    { x: 13, y: 2, rows: ['.OO.', 'OBBO', 'OBBO', 'OBBO', 'OBBO', 'OBBO', 'OBBO', '.OO.'] },
    { eye: { w: 2, h: 1, spread: 2, dy: 1 } },
  );
  const weaverBase = grow(weaver1, null, web);
  const WEA_E = { eye: { w: 2, h: 1, spread: 2, dy: 1 } };
  const WEA_HEAD = ['.OBBBBBSBBBBBO.', '.OBBBBBSBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO'];
  // 옆으로 뻗어 땅을 짚는 거미 다리 (무릎이 위로 꺾인다)
  function leg(a, d, y, reach, t, k) {
    const O = this.colors.outline, J = this.colors.light;
    const edge = d < 0 ? a.left : a.right;
    const lift = Math.sin(t * 3 + k * 1.7) > 0.85 ? 1 : 0;
    const knee = Math.ceil(reach / 2);
    for (let i = 1; i <= reach; i++) {
      const up = i <= knee ? i : knee - (i - knee) * 0.5;
      this.px(edge + d * i, y - up, i === knee ? J : O, false);
      this.px(edge + d * i, y - up + 1, O, false);
    }
    const fx = edge + d * reach, fy = Math.round(y - (knee - (reach - knee) * 0.5)) + 1;
    for (let yy = fy; yy <= a.ground - lift; yy++) this.px(fx, yy, O, false);
  }
  const extraEyes = (color, n) => function (g, a, t) {
    const on = !per(t, 3.7, 0.15);
    if (!on) return;
    this.px(a.eyeL, a.ey - 2, color);
    this.px(a.eyeR + a.ew - 1, a.ey - 2, color);
    if (n > 2) {
      this.px(a.eyeL - 2, a.ey - 1, color);
      this.px(a.eyeR + a.ew + 1, a.ey - 1, color);
      this.px(a.hx - 1, a.top + 1, color);
      this.px(a.hx + 1, a.top + 1, color);
    }
  };
  const weaver2 = form(
    [...WEA_HEAD, 'OBBBBBBBBBBBBBO', 'OBOOOBOOOBOOOBO', 'OBO.OBO.OBO.OBO', 'OOO.OOO.OOO.OOO'],
    // 꼬리 대신 실을 뽑는 통통한 배
    { x: 13, y: 5, rows: ['.OOOO.', 'OBBBBO', 'OBSSBO', 'OBBSBO', 'OBSSBO', 'OBBBBO', '.OOOO.'] },
    {
      ...WEA_E,
      back: awake(function (g, a, t) {
        leg.call(this, a, -1, a.neck, 6, t, 0);
        leg.call(this, a, 1, a.neck - 3, 4, t, 1);
      }),
      mark: marks(web, extraEyes('#ff5a5a', 2), awake(function (g, a, t) {
        // 배 끝에서 뽑아 올린 실 한 가닥
        const W = '#e9eef5', sw = per(t, 2, 1) ? 1 : 0;
        for (let j = 0; j < 9; j++) this.px(a.right + 6 + (j > 4 ? sw : 0), a.neck - 5 - j, W, false);
      })),
    },
  );
  const weaver3 = form(
    [...WEA_HEAD, 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OBOOOBOOOBOOOBO', 'OBO.OBO.OBO.OBO', 'OOO.OOO.OOO.OOO'],
    { x: 13, y: 5, rows: ['.OOOOO.', 'OBBBBBO', 'OBSBSBO', 'OBBSBBO', 'OBSBSBO', 'OBBBBBO', 'OBBBBBO', '.OOOOO.'] },
    {
      ...WEA_E,
      sparkle: '#c9f2ff',
      back: awake(function (g, a, t) {
        // 등 뒤에 펼친 별그물: 살 여덟 개와 고리 둘, 마디가 별처럼 깜빡인다
        const cx = a.hx, cy = a.top + 3, W = '#b9c6d8';
        const px0 = this.px;
        // 땅 아래로는 그리지 않는다
        const dot = (x, y, c) => { if (Math.round(y) < a.ground) px0.call(this, x, y, c, false); };
        for (let k = 0; k < 8; k++) {
          const ang = (k * Math.PI) / 4 + Math.PI / 8;
          for (let r = 4; r <= 17; r++) dot(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.95, W);
          for (const r of [10, 17]) {
            const on = Math.sin(t * 2.4 + k * 1.3 + r) > 0.2;
            dot(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.95, on ? '#ffffff' : '#7fe3ff');
          }
        }
        for (const r of [10, 17]) for (let d = 0; d < 64; d++) {
          const ang = (d * Math.PI) / 32;
          const sag = 1 - 0.12 * Math.abs(Math.sin(ang * 4 + Math.PI / 2));
          dot(cx + Math.cos(ang) * r * sag, cy + Math.sin(ang) * r * 0.95 * sag, W);
        }
        leg.call(this, a, -1, a.neck, 7, t, 0);
        leg.call(this, a, 1, a.neck, 7, t, 1);
        leg.call(this, a, -1, a.neck - 4, 5, t, 2);
        leg.call(this, a, 1, a.neck - 4, 5, t, 3);
      }),
      mark: marks(web, extraEyes('#7fe3ff', 6)),
    },
  );

  /* ── 올빼미: 올빼미 → 달깃(접은 날개 · 부채 꼬리 · 깃 눈썹) → 별밤(펼친 날개 · 등 뒤 초승달 · 별) ── */
  const owl1 = body(
    ['.OBBBBBBBBBBBO.', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OSBBBBBBBBBBBSO', 'OSSBBBBBBBBBSSO', '.OSBBBBBBBBBSO.', '..OBBBBBBBBBO..', '...OBOOOOOBO...', '...OOO...OOO...'],
    { x: 13, y: 4, rows: ['.OO.', 'OBBO', 'OSBO', 'OBBO', 'OSBO', '.OO.'] },
    { eye: { w: 3, h: 3, spread: 2, dy: -1 } },
  );
  function moon(g, a) {
    this.pattern(['.YY', 'Y..', '.YY'], a.hx - 1, a.top, { Y: GOLD });
  }
  const owlBase = grow(owl1, null, moon);
  const OWL_E = { eye: { w: 3, h: 3, spread: 2, dy: -1 } };
  const OWL_HEAD = ['.OBBBBBBBBBBBO.', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OSBBBBBBBBBBBSO', 'OSSBBBBBBBBBSSO', 'OSSSBLBLBLBSSSO', 'OSSSLBLBLBLSSSO'];
  function owlFace(g, a) {
    // 눈 위로 치켜 올라간 깃 눈썹과 작은 부리
    const L = g.c.light;
    this.pattern(['L....', '.LLLL'], a.eyeL - 2, a.ey - 2, { L });
    this.pattern(['....L', 'LLLL.'], a.eyeR, a.ey - 2, { L });
    this.pattern(['YYY', '.Y.'], a.hx - 1, a.my, { Y: '#ffb347' });
  }
  const owl2 = form(
    [...OWL_HEAD, '.OSSBBBBBBBSSO.', '..OOBOOOOOBOO..', '...OOO...OOO...'],
    { x: 13, y: 8, rows: ['.OOO.', 'OSBSO', 'OBSBO', 'OSBSO', '.OOO.'] },
    { ...OWL_E, mark: marks(moon, awake(owlFace)) },
  );
  const owl3 = form(
    [...OWL_HEAD, 'OSSSBLBLBLBSSSO', '.OSSBBBBBBBSSO.', '..OOBOOOOOBOO..', '...OOO...OOO...'],
    { x: 13, y: 8, rows: ['..OOO.', '.OSBSO', 'OSBSBO', 'OBSBSO', 'OSBSBO', '.OOOO.'] },
    {
      ...OWL_E,
      sparkle: '#fff3a8',
      back: marks(
        awake(function (g, a) {
          // 등 뒤에 걸린 큰 초승달
          this.pattern(['...YYYY..', '.YYYY....', '.YYY.....', 'YYY......', 'YYY......', 'YYY......', '.YYY.....', '.YYYY....', '...YYYY..'], a.right - 1, a.top - 9, { Y: GOLD }, false);
        }),
        wings((g) => ({ O: g.c.outline, W: g.c.body, S: g.c.stripe || g.c.shade })),
      ),
      mark: marks(moon, awake(owlFace), orbit('#fff3a8', 4, 13, 1.1)),
    },
  );

  /* ── 달리기: 바람 → 번개(번개 꼬리 · 뾰족 털 · 불꽃 튀는 전기) → 불꽃(불 갈기 · 불 꼬리 · 불 발) ── */
  const dash1 = body(
    ['.OBBBSBSBSBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '..OBBOOOOOBBO..', '..OBO.....OBO..', '..OBO.....OBO..', '..OO......OO...'],
    { x: 13, y: 4, rows: ['.OO.', 'OBBO', '.OO.'] },
    { eye: { w: 2, h: 2, spread: 2, dy: 0 } },
  );
  function bolt(g, a) {
    for (const [x, d] of [[a.left + 1, 1], [a.right - 1, -1]]) {
      this.px(x, a.neck - 3, GOLD);
      this.px(x + d, a.neck - 2, GOLD);
      this.px(x, a.neck - 1, GOLD);
    }
  }
  function speedLines(g, a, t) {
    const off = Math.floor(t * 8) % 3;
    for (let k = 0; k < 3; k++) this.rect(a.left - 6 - off, a.neck - 4 + k * 2, 3, 1, 'rgba(255,255,255,0.7)');
  }
  const dashBase = grow(dash1, null, bolt);
  const DASH_HEAD = ['.OBBBSBSBSBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', 'OOBBBBBBBBBBBOO', '.OBBBBBBBBBBBO.', 'OOBBBBBBBBBBBOO', '..OBBBLLLBBBO..', '..OBBOOOOOBBO..'];
  const dash2 = form(
    [...DASH_HEAD, '..OBO.....OBO..', '..OO......OO...'],
    // 번개 모양으로 꺾인 꼬리
    { x: 13, y: 2, rows: ['....OO', '...OLO', '..OLO.', '.OLOOO', 'OLLLLO', 'OOOLO.', '..OBO.', '.OBO..', 'OBO...', 'OO....'] },
    {
      mark: marks(bolt, speedLines, awake(function (g, a, t) {
        // 이마의 번개 무늬, 몸 둘레로 튀는 전기
        this.pattern(['.YY', 'YY.', '.YY', 'YY.'], a.hx - 1, a.top, { Y: GOLD });
        for (let k = 0; k < 4; k++) {
          const n = Math.floor(t * 9 + k * 2.3);
          if (n % 3) continue;
          const x = a.cx + (((n * 7 + k * 11) % 26) - 13), y = a.top - 2 + ((n * 5 + k * 7) % 16);
          this.pattern(['Y.', '.Y', 'Y.'], x, y, { Y: k % 2 ? '#fff7b0' : GOLD }, false);
        }
      })),
    },
  );
  const FIRE = { R: '#ff5a1f', Y: '#ffc23a', W: '#fff3c4' };
  const dash3 = form(
    [...DASH_HEAD, '..OBO.....OBO..', '..OBO.....OBO..', '..OO......OO...'],
    { x: 13, y: 9, rows: ['.OO.', 'OLLO', 'OBBO', '.OO.'] },
    {
      sparkle: '#ffe9a8',
      back: awake(function (g, a, t) {
        // 머리 둘레로 타오르는 불 갈기
        const f = Math.floor(t * 9);
        for (let i = -8; i <= 8; i++) {
          const h = 2 + ((f + i * 5 + (i * i) % 3) % 4) + (Math.abs(i) < 3 ? 2 : 0);
          const y0 = a.top + 1 + Math.round(Math.abs(i) * 0.6);
          for (let j = 0; j < h; j++) this.px(a.hx + i, y0 - j, j > h - 2 ? FIRE.W : j > h - 4 ? FIRE.Y : FIRE.R, false);
        }
        for (const d of [-1, 1]) for (let j = 0; j < 7; j++) {
          const out = 1 + ((f + j * 3) % 3);
          for (let i = 1; i <= out; i++) this.px((d < 0 ? a.left : a.right) + d * i, a.top + 2 + j, i === out ? FIRE.Y : FIRE.R, false);
        }
        // 불꽃 꼬리
        const T = f % 2 ? ['..R...', '.RYR..', '.RYYR.', 'RYWYR.', 'RYWWYR', '.RYYR.', '..RR..'] : ['...R..', '..RYR.', '.RYYR.', '.RYWYR', 'RYWWYR', '.RYYR.', '..RR..'];
        this.pattern(T, a.right + 3, a.neck - 6, FIRE, false);
      }),
      mark: marks(bolt, awake(function (g, a, t) {
        const f = Math.floor(t * 9);
        this.pattern(['.YY', 'YY.', '.YY', 'YY.'], a.hx - 1, a.top, { Y: FIRE.Y });
        // 발끝의 불과 날리는 불티
        for (const x of [a.cx - 6, a.cx + 3]) this.pattern(f % 2 ? ['.R.', 'RYR'] : ['R.R', 'YRY'], x, a.ground - 1, FIRE, false);
        for (let k = 0; k < 5; k++) {
          const p = (t * 0.7 + k * 0.21) % 1;
          this.px(a.cx - 12 + k * 6 + Math.round(Math.sin(t * 2 + k) * 2), a.ground - 2 - p * 26, p > 0.6 ? FIRE.Y : FIRE.R, false);
        }
      })),
    },
  );

  /* ── 별밤 (귀함): 별가루 → 은하(몸을 두른 고리 · 이마 별) → 천사(날개 · 고리 · 별) ── */
  const starTail = { x: 13, y: 1, rows: ['OOO.', 'OLLO', '..OBO', '..OBO', '.OBBO', 'OBBO', 'OBBO', '.OO.'] };
  const star1 = body(
    ['.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '..OBBBBBBBBBO..', '..OBBBBBBBBBO..', '...OBBBBBBBO...', '...OBBBBBBBO...', '...OBOOOOOBO...', '....O.....O....'],
    starTail,
  );
  const dust = (n) =>
    function (g, a, t) {
      const spots = [[-4, 3], [3, 5], [-2, 7], [4, 8], [-5, 9], [1, 10], [5, 4], [-3, 5]].slice(0, n);
      spots.forEach(([dx, dy], k) => {
        this.px(a.hx + dx, a.top + dy, Math.sin(t * 2 + k) > 0.6 ? '#ffffff' : '#ffe98a');
      });
    };
  function halo(g, a, t) {
    const c = per(t, 1.2, 0.6) ? '#fff3a8' : GOLD;
    this.rect(a.hx - 3, a.top - 4, 7, 1, c);
    this.px(a.hx - 4, a.top - 3, c, false);
    this.px(a.hx + 4, a.top - 3, c, false);
    this.rect(a.hx - 3, a.top - 2, 7, 1, c);
  }
  const starBase = grow(star1, null, dust(4));
  const STAR_HEAD = ['.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '..OBBBBBBBBBO..', '..OBBBBBBBBBO..', '...OBBBBBBBO...', '..OBBBLLLBBBO..'];
  // 몸을 두른 행성 고리: 뒤쪽 반은 back, 앞쪽 반은 mark 에서
  const ring = (front) => awake(function (g, a, t) {
    for (let d = 0; d < 48; d++) {
      const ang = (d * Math.PI) / 24;
      if (Math.sin(ang) > 0 !== front) continue;
      const x = a.cx + Math.cos(ang) * 13, y = a.neck + 1 + Math.sin(ang) * 3.2 - Math.cos(ang) * 2;
      this.px(x, y, (d + Math.floor(t * 6)) % 8 === 0 ? '#ffffff' : d % 2 ? '#ffe98a' : '#c9a8ff', false);
    }
  });
  function foreStar(g, a) {
    this.pattern(['..Y..', '.YYY.', 'YYWYY', '.YYY.', '..Y..'], a.hx - 2, a.top, { Y: GOLD, W: '#ffffff' });
  }
  const star2 = form(
    [...STAR_HEAD, '..OBBBLLLBBBO..', '...OBOOOOOBO...', '....O.....O....'],
    { x: 13, y: 1, rows: ['.OOO.', 'OLLLO', 'OLLLO', '.OOBO', '..OBO', '.OBBO', 'OBBO', 'OBBO', '.OO.'] },
    { back: ring(false), mark: marks(dust(8), foreStar, ring(true)) },
  );
  const star3 = form(
    [...STAR_HEAD, '..OBBBLLLBBBO..', '..OBBBLLLBBBO..', '...OBOOOOOBO...', '....O.....O....'],
    { x: 13, y: 2, rows: ['.OOO.', 'OLLLO', 'OLLLO', '.OOBO', '..OBO', '.OBBO', 'OBBO', 'OBBO', '.OO.'] },
    {
      sparkle: '#ffffff',
      back: wings(() => ({ O: '#8fa4c8', W: '#ffffff', S: '#dbe6f7' })),
      mark: marks(dust(8), foreStar, awake(halo), orbit('#ffffff', 3, 13, 2)),
    },
  );

  /* ── 두 꼬리 (귀함): 두꼬리 → 여우불(세 갈래 꼬리 · 붉은 무늬 · 꼬리 끝 불) → 네코마타(양쪽으로 갈라진 큰 꼬리 · 금줄 · 도깨비불) ── */
  const twinTail = { x: 13, y: 2, rows: ['O.O.', 'OBOB', 'OBOB', 'OBBO', 'OBBO', 'OBBO', '.OO.'] };
  const twin1 = body(
    ['.OBBBCBBBCBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBLLLBBBBO.', '..OBBLLLLLBBO..', '..OBBBLLLBBBO..', '...OBBBLBBBO...', '...OBBOOOBBO...', '...OOO...OOO...'],
    twinTail,
    { eye: { w: 2, h: 2, spread: 2, dy: 0 } },
  );
  const TWIN_HEAD = ['.OBBBCBBBCBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', 'OOBBBLLLLLBBBOO', '.OOBLLLLLLLBOO.', '..OBBLLLLLBBO..', '..OBBBLLLBBBO..'];
  const WISP = { B: '#4f9be8', W: '#e6f6ff', b: '#9fd4ff' };
  const flameAt = function (x, y, t, k) {
    const f = Math.floor(t * 7 + k) % 2;
    this.pattern(f ? ['.b.', '.B.', 'BWB', 'BWB', '.B.'] : ['..b', '.B.', 'BWB', 'BWB', '.B.'], x - 1, y - 4, WISP, false);
  };
  function foxMarks(g, a) {
    const R = '#d9482b';
    this.pattern(['R.', 'RR'], a.eyeL - 2, a.my, { R });
    this.pattern(['.R', 'RR'], a.eyeR + a.ew, a.my, { R });
    this.pattern(['R.R', '.R.'], a.hx - 1, a.top + 1, { R });
  }
  const twin2 = form(
    [...TWIN_HEAD, '...OBBBLBBBO...', '...OBBOOOBBO...', '...OOO...OOO...'],
    // 세 갈래 꼬리
    { x: 13, y: 3, rows: ['.O.O.O.', 'OLOLOLO', 'OBOBOBO', 'OBOBOBO', 'OBBBBO.', 'OBBBO..', 'OBBO...', '.OO....'] },
    {
      back: awake(function (g, a, t) {
        for (let k = 0; k < 3; k++) flameAt.call(this, a.right + 1 + k * 2, a.top - 1 - (k === 1 ? 1 : 0), t, k);
      }),
      mark: awake(foxMarks),
    },
  );
  const BIGTAIL = ['....OOO.', '...OLLLO', '..OLLLO.', '.OLLBO..', '.OBBBO..', 'OBBBO...', 'OBBBO...', 'OBBBO...', 'OBBO....', '.OO.....'];
  const twin3 = form(
    [...TWIN_HEAD, '..OBBBLLLBBBO..', '...OBBBLBBBO...', '...OBBOOOBBO...', '...OOO...OOO...'],
    { x: 13, y: 2, rows: BIGTAIL },
    {
      sparkle: '#dff3ff',
      back: awake(function (g, a, t) {
        // 왼쪽으로 갈라진 또 하나의 꼬리 (오른쪽은 몸 도트의 꼬리), 꼬리 끝마다 도깨비불
        const c = g.c, sw = Math.round(Math.sin(t * 1.6));
        mir(BIGTAIL).forEach((row, j) => this.pattern([row], a.left - 6 - Math.round(sw * (1 - j / 9)), a.top + j, { O: c.outline, B: c.body, L: c.light }, false));
        flameAt.call(this, a.left - 5 - sw, a.top - 1, t, 0);
        flameAt.call(this, a.right + 6 + sw, a.top - 1, t, 1);
      }),
      mark: marks(awake(foxMarks), awake(function (g, a) {
        // 목에 두른 금줄과 방울
        const S = '#efe2c0', s = '#b89f6a';
        for (let i = 0; i < 11; i++) this.px(a.left + 1 + i, a.neck, i % 3 === 1 ? s : S);
        for (const dx of [-3, 3]) this.pattern(['S', 'S', 's'], a.hx + dx, a.neck + 1, { S, s });
        this.pattern(['YYY', 'YKY', '.Y.'], a.hx - 1, a.neck + 1, { Y: GOLD, K: '#7a5a12' });
      }), orbit('#9fd4ff', 3, 14, -1.3)),
    },
  );

  /* ══ 새 품종 넷 (2026-11) ══ */

  /* ── 새싹: 머리에 떡잎 → 꽃봉오리(큰 잎 · 덩굴 목걸이) → 숲지기(가지 뿔 · 꽃 · 나비 · 꽃잎) ── */
  const LEAF = { G: '#6fcf5a', g: '#3f9a3a', P: '#ff8fb5', p: '#e0608a', Y: GOLD, K: '#7a5a32', O: '#2f5a2a' };
  const SPR_HEAD = ['.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OBBBBBBBBBBBBBO', 'OBBBBMMMMMBBBBO', '.OBBBMMMMMBBBO.'];
  const SPR_FEET = ['..OBBOOOOOBBO..', '..OOO.....OOO..'];
  function sproutLeaf(g, a, t) {
    const s = per(t, 3, 0.4) ? 1 : 0;
    this.pattern(['GG...GG', '.GGgGG.', '...g...'], a.hx - 3 + s, a.top - 2, LEAF);
  }
  const sprout1 = form([...SPR_HEAD, '.OBBBBMMMBBBBO.', ...SPR_FEET], { x: 13, y: 5, rows: ['..OO', '.OLO', 'OLLO', 'OLO.', 'OO..'] }, { mark: sproutLeaf });
  const PETAL = ['..OO.', '.OGGO', 'OGgGO', 'OGgGO', 'OGgGO', '.OGO.'];
  const sprout2 = form(
    [...SPR_HEAD, '.OBBBBMMMBBBBO.', '.OBBBBMMMBBBBO.', ...SPR_FEET],
    { x: 13, y: 4, rows: ['...OO', '..OLO', '.OLLO', 'OLBLO', 'OLLO.', 'OBO..', 'OO...'] },
    {
      back: awake(function (g, a) {
        this.pattern(PETAL, a.right - 1, a.top, LEAF, false);
        this.pattern(mir(PETAL), a.left - 3, a.top, LEAF, false);
        this.pattern(PETAL.slice(1), a.right + 1, a.top + 5, LEAF, false);
        this.pattern(mir(PETAL.slice(1)), a.left - 5, a.top + 5, LEAF, false);
      }),
      mark: awake(function (g, a, t) {
        // 머리 위 꽃봉오리 (가끔 살짝 벌어진다), 덩굴 목걸이
        const open = per(t, 4, 1);
        this.pattern(open ? ['.P.P.', 'PPYPP', '.PpP.', 'GGgGG', '..g..'] : ['..P..', '.PPP.', '.PpP.', 'GGgGG', '..g..'], a.hx - 2, a.top - 4, LEAF);
        for (let i = 0; i < 11; i++) this.px(a.left + 1 + i, a.neck, i % 2 ? LEAF.g : LEAF.G);
        this.pattern(['P.P', '.Y.', 'P.P'], a.hx - 1, a.neck - 1, LEAF);
      }),
    },
  );
  const BRANCH = ['....G..GG', '.GG.GK.G.', '.GPG.K.K.', '..GK.KK..', '...KKK...', '....K....', '....K....'];
  const sprout3 = form(
    [...SPR_HEAD, 'OBBBBBMMMBBBBBO', 'OBBSBBMMMBBSBBO', '.OBBBBMMMBBBBO.', ...SPR_FEET],
    { x: 13, y: 3, rows: ['.OO..', 'OLLO.', 'OLO..', '.OBO.', '..OBO', '..OBO', '.OBO.', 'OBO..', 'OO...'] },
    {
      sparkle: '#eaffd8',
      back: awake(function (g, a) {
        // 머리에서 뻗은 나뭇가지 뿔, 등 뒤 큰 잎
        this.pattern(BRANCH, a.hx + 1, a.top - 7, LEAF, false);
        this.pattern(mir(BRANCH), a.hx - 9, a.top - 7, LEAF, false);
        this.pattern(PETAL, a.right, a.top + 2, LEAF, false);
        this.pattern(mir(PETAL), a.left - 4, a.top + 2, LEAF, false);
      }),
      mark: marks(awake(function (g, a, t) {
        // 이마의 화관, 흩날리는 꽃잎
        this.pattern(['P.G.Y.G.P', '.G.P.P.G.'], a.hx - 4, a.top + 1, LEAF);
        for (let i = 0; i < 11; i++) this.px(a.left + 1 + i, a.neck, i % 3 === 1 ? LEAF.P : LEAF.G);
        for (let k = 0; k < 6; k++) {
          const p = (t * 0.25 + k / 6) % 1;
          this.px(a.cx - 15 + k * 6 + Math.round(Math.sin(t * 1.5 + k * 2) * 2), a.top - 8 + p * 30, k % 2 ? LEAF.P : '#ffd0e0', false);
        }
      }), orbit('#ff8fb5', 2, 14, 0.9)),
    },
  );

  /* ── 물방울: 이마 물방울 · 물고기 꼬리 → 파도(볼 지느러미 · 물보라) → 해룡(큰 지느러미 · 산호 뿔 · 수염 · 물 고리) ── */
  const SEA = { B: '#4aa8e8', b: '#9fd8ff', W: '#ffffff', O: '#2b6fa8', R: '#ff8fa3', r: '#e0607a' };
  const TIDE_HEAD = ['.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '..OBBBBBBBBBO..', '..OBBMMMMMBBO..', '...OBMMMMMBO...'];
  const TIDE_FEET = ['...OBOOOOOBO...', '...OO.....OO...'];
  function tideFace(g, a) {
    this.pattern(['.B.', 'BbB', 'BBB', '.B.'], a.hx - 1, a.top, SEA);
    for (const [x, d] of [[a.left + 1, 1], [a.right - 1, -1]]) {
      this.px(x, a.my, SEA.B);
      this.px(x + d, a.my, SEA.B);
      this.px(x, a.my + 2, SEA.B);
    }
  }
  function tideWave(g, a, t) {
    const f = Math.floor(t * 4) % 3;
    const row = (s) => (s.repeat(8)).slice(f, f + 20);
    this.pattern([row('.b.'), row('bBb'), row('BBB')], a.cx - 10, a.ground - 2, SEA, false);
  }
  function tideBubbles(g, a, t) {
    for (let k = 0; k < 4; k++) {
      const p = (t * 0.35 + k * 0.27) % 1;
      const x = a.cx + (k % 2 ? 11 : -12) + (k > 1 ? 3 : 0) + Math.round(Math.sin(t * 2 + k) * 1.5), y = a.ground - 4 - p * 26;
      this.pattern(k % 2 ? ['.B.', 'B.B', '.B.'] : ['B'], x, y, SEA, false);
    }
  }
  const tide1 = form([...TIDE_HEAD, '...OBMMMMMBO...', ...TIDE_FEET], { x: 13, y: 4, rows: ['O...O', 'OLOLO', 'OLLLO', '.OLO.', '.OBO.', 'OBO..', 'OO...'] }, { mark: tideFace });
  const FIN = ['...OO', '..ObO', '.ObBO', 'ObBBO', '.ObBO', 'ObBBO', '.ObBO', '..OOO'];
  const tide2 = form(
    [...TIDE_HEAD, '..OBBMMMMMBBO..', '...OBMMMMMBO...', ...TIDE_FEET],
    { x: 13, y: 2, rows: ['OO...OO', 'OLO.OLO', 'OLLOLLO', '.OLLLO.', '..OLO..', '..OBO..', '.OBO...', 'OBO....', 'OO.....'] },
    {
      back: awake(function (g, a) {
        this.pattern(FIN, a.left - 4, a.top + 1, SEA, false);
        this.pattern(mir(FIN), a.right, a.top + 1, SEA, false);
      }),
      mark: marks(tideFace, awake(tideBubbles), awake(tideWave)),
    },
  );
  const FRILL = ['.....OO', '...OObO', '..ObBBO', '.ObBbBO', 'ObBBBBO', '.ObBbBO', 'ObBBBBO', '.ObBbBO', '..ObBBO', '...OOOO'];
  const tide3 = form(
    [...TIDE_HEAD, '..OBBMMMMMBBO..', '..OBSMMMMMSBO..', '...OBMMMMMBO...', ...TIDE_FEET],
    { x: 13, y: 0, rows: ['OO...OO', 'OLO.OLO', 'OLLOLLO', '.OLLLO.', '..OLO..', '..OBO..', '..OBO..', '.OBO...', '.OBO...', 'OBO....', 'OO.....'] },
    {
      sparkle: '#dff6ff',
      back: awake(function (g, a, t) {
        // 머리 뒤로 도는 물 고리, 큰 지느러미, 산호 뿔
        for (let d = 0; d < 60; d++) {
          const ang = (d * Math.PI) / 30;
          if (Math.sin(ang) > 0.55) continue;
          const c = (d + Math.floor(t * 10)) % 6 === 0 ? SEA.W : d % 2 ? SEA.B : SEA.b;
          this.px(a.hx + Math.cos(ang) * 15, a.top + 5 + Math.sin(ang) * 13, c, false);
        }
        this.pattern(FRILL, a.left - 6, a.top, SEA, false);
        this.pattern(mir(FRILL), a.right, a.top, SEA, false);
        this.pattern(['R.R..', 'R.Rr.', '.RR..', '.Rr..', '.R...'], a.hx - 7, a.top - 5, SEA, false);
        this.pattern(mir(['R.R..', 'R.Rr.', '.RR..', '.Rr..', '.R...']), a.hx + 3, a.top - 5, SEA, false);
      }),
      mark: marks(tideFace, awake(function (g, a, t) {
        // 물결치는 긴 수염
        for (let j = 0; j < 8; j++) {
          const w = Math.round(Math.sin(t * 2 + j * 0.7) * 1.2);
          this.px(a.left - 1 - Math.floor(j / 3) + w, a.my + 1 + j, SEA.b, false);
          this.px(a.right + 1 + Math.floor(j / 3) + w, a.my + 1 + j, SEA.b, false);
        }
      }), awake(tideWave), orbit('#9fd8ff', 3, 14, 1.2)),
    },
  );

  /* ── 톱니: 안테나 · 볼트 → 태엽(등의 태엽 열쇠 · 가슴 불빛) → 강철(바이저 · 추진기 · 가슴 코어 · 도는 톱니) ── */
  const MET = { K: '#4d5661', k: '#9aa5b3', Y: GOLD, y: '#d9a21f', C: '#5fe3ff', R: '#ff5a5a', W: '#ffffff', O: '#2c333c' };
  const GEAR_HEAD = ['.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '..OOOOOOOOOOO..'];
  const GEAR_FEET = ['.OBBOOBBBOOBBO.', '..OO..OOO..OO..'];
  function gearBolts(g, a) {
    this.pattern(['kkk', 'kKk', 'kkk'], a.hx - 1, a.top + 1, MET);
    this.px(a.left + 2, a.my + 1, MET.k);
    this.px(a.right - 2, a.my + 1, MET.k);
  }
  function antenna(g, a, t) {
    this.rect(a.hx, a.top - 3, 1, 3, MET.K);
    this.pattern(['.R.', 'RRR', '.R.'], a.hx - 1, a.top - 6, { R: per(t, 1.6, 0.8) ? MET.R : '#8a2f2f' }, false);
  }
  const gear1 = form([...GEAR_HEAD, '.OBBSMMMMMSBBO.', ...GEAR_FEET], { x: 13, y: 5, rows: ['.OOO', '.OLO', '.OOO', 'OBO.', 'OBO.', 'OO..'] }, { mark: marks(gearBolts, awake(antenna)) });
  const gear2 = form(
    [...GEAR_HEAD, '.OBBSMMMMMSBBO.', '.OBBSMMMMMSBBO.', ...GEAR_FEET],
    { x: 13, y: 5, rows: ['.OOO', '.OLO', '.OOO', 'OBO.', 'OBO.', 'OBO.', 'OO..'] },
    {
      // 등에 꽂힌 태엽 열쇠가 돈다
      back: awake(function (g, a, t) {
        const flat = per(t, 1.2, 0.3) || per(t + 0.6, 1.2, 0.3);
        this.pattern(
          flat ? ['....O....', '...OYO...', '...OYO...', '...OYO...', '...OYO...', '....Y....', '....Y....', '....Y....'] : ['.OOO.OOO.', 'OYYYOYYYO', 'OY.YOY.YO', 'OYYYOYYYO', '.OOOYOOO.', '....Y....', '....Y....', '....Y....'],
          a.hx - 4, a.top - 8, MET, false,
        );
      }),
      mark: marks(gearBolts, awake(function (g, a, t) {
        // 가슴의 불빛, 옆으로 새는 김
        this.pattern(['KKKKK', 'KCRYK', 'KKKKK'], a.hx - 2, a.neck + 1, { ...MET, C: per(t, 1, 0.5) ? MET.C : '#2a6f80' });
        const p = (t * 0.6) % 1;
        if (p < 0.6) this.pattern(['.W', 'WW'], a.left - 3 - Math.round(p * 4), a.neck - 1 - Math.round(p * 5), { W: 'rgba(255,255,255,0.8)' }, false);
      })),
    },
  );
  const POD = ['.OOO.', 'OkkkO', 'OkKkO', 'OkKkO', 'OKKKO', '.OOO.'];
  const gear3 = form(
    [...GEAR_HEAD, 'OOBBSMMMMMSBBOO', 'OBBBSMMMMMSBBBO', 'OBBBSMMMMMSBBBO', ...GEAR_FEET],
    { x: 13, y: 7, rows: ['.OOO', '.OLO', '.OOO', 'OBO.', 'OO..'] },
    {
      sparkle: '#e8f6ff',
      back: awake(function (g, a, t) {
        // 어깨의 추진기와 불꽃, 쌍 안테나
        const f = Math.floor(t * 10) % 2;
        for (const x of [a.left - 5, a.right + 1]) {
          this.pattern(POD, x, a.neck - 4, MET, false);
          this.pattern(f ? ['.YYY.', '.RYR.', '..R..'] : ['.YYY.', '.RYR.', '.R.R.', '..R..'], x, a.neck + 2, FIRE, false);
        }
        for (const d of [-1, 1]) {
          for (let j = 0; j < 5; j++) this.px(a.hx + d * (5 + (j > 2 ? 1 : 0)), a.top - j, MET.K, false);
          this.pattern(['C', 'C'], a.hx + d * 6, a.top - 6, { C: per(t + (d > 0 ? 0.4 : 0), 0.8, 0.4) ? MET.C : MET.W }, false);
        }
      }),
      mark: marks(gearBolts, awake(function (g, a, t) {
        // 눈 위를 훑는 바이저, 뛰는 가슴 코어, 둘레를 도는 톱니
        const x0 = a.eyeL - 1, w = a.eyeR + a.ew + 1 - x0;
        this.rect(x0, a.ey - 2, w, 1, MET.C);
        this.px(x0 + (Math.floor(t * 8) % w), a.ey - 2, MET.W);
        const big = per(t, 1, 0.5);
        this.pattern(big ? ['.CCC.', 'CCWCC', 'CWWWC', 'CCWCC', '.CCC.'] : ['.....', '.CCC.', '.CWC.', '.CCC.', '.....'], a.hx - 2, a.neck + 1, MET);
        for (let k = 0; k < 2; k++) {
          const ang = t * 1.2 + k * Math.PI, turn = Math.floor(t * 4) % 2;
          this.pattern(turn ? ['.k.k.', 'kkkkk', '.kKk.', 'kkkkk', '.k.k.'] : ['k.k.k', '.kkk.', 'kkKkk', '.kkk.', 'k.k.k'], a.cx + Math.cos(ang) * 15 - 2, a.cy - 6 + Math.sin(ang) * 6, MET, false);
        }
      })),
    },
  );

  /* ── 아기용 (귀함): 작은 뿔 → 날개(박쥐 날개 · 콧김) → 화룡(큰 날개 · 긴 뿔 · 불 뿜기) ── */
  const DRG = { H: GOLD, h: '#d9a21f', M: '#a56ae8', m: '#6f3fb8', O: '#3a2458', R: '#ff5a5a', W: '#ffffff' };
  const DRG_HEAD = ['.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '.OBBBBBBBBBBBO.', '..OBBMMMMMBBO..', '..OBMMMMMMMBO..'];
  const DRG_FEET = ['..OBBOOOOOBBO..', '..OOO.....OOO..'];
  const horns = (rows) => function (g, a) {
    this.pattern(rows, a.hx + 3, a.top - rows.length + 2, DRG, false);
    this.pattern(mir(rows), a.hx - 2 - rows[0].length, a.top - rows.length + 2, DRG, false);
  };
  function snort(g, a, t) {
    const p = (t * 0.5) % 1;
    if (p > 0.5) return;
    for (const d of [-1, 1]) this.pattern(['WW', 'WW'], a.hx + d * (3 + Math.round(p * 6)) - (d < 0 ? 1 : 0), a.my + 1 - Math.round(p * 6), { W: 'rgba(255,255,255,0.75)' }, false);
  }
  const dragon1 = form([...DRG_HEAD, '..OBBMMMMMBBO..', ...DRG_FEET], { x: 13, y: 4, rows: ['..O..', '.OLO.', 'OLLLO', '.OBO.', '.OBO.', 'OBO..', 'OO...'] }, { mark: horns(['H', 'H', 'h']) });
  const SWING = ['OOOO....', 'OMMMOO..', 'OMmMMMO.', 'OMOMmMMO', 'OO.OMOMO', '....O.O.'];
  const dragon2 = form(
    [...DRG_HEAD, '..OBMMMMMMMBO..', '..OBBMMMMMBBO..', ...DRG_FEET],
    { x: 13, y: 3, rows: ['..O..', '.OLO.', 'OLLLO', 'OLLLO', '.OBO.', '.OBO.', 'OBO..', 'OO...'] },
    {
      back: awake(function (g, a, t) {
        const up = per(t, 1.2, 0.6) ? 0 : 1;
        this.pattern(SWING, a.right - 1, a.neck - 7 + up, DRG, false);
        this.pattern(mir(SWING), a.left - 6, a.neck - 7 + up, DRG, false);
      }),
      mark: marks(horns(['.H', 'HH', 'Hh', 'h.']), awake(snort)),
    },
  );
  const BWING_UP = ['.......OOO.', '.....OOMMMO', '...OOMMmMMO', '.OOMMMmMMMO', 'OMMMmMMOMMO', 'OMmMMMO.OMO', 'OMMMOO..OMO', 'OMOO.....O.', 'OO.........'];
  const BWING_DN = ['OOOO.......', 'OMMMOOO....', 'OMmMMMMOO..', 'OMMmMMMMMO.', '.OMMmMMOMMO', '.OMMMMO.OMO', '..OMMO..OMO', '..OMO....O.', '...O.......'];
  const dragon3 = form(
    [...DRG_HEAD, '.OOBMMMMMMMBOO.', '.OBBSMMMMMSBBO.', '..OBBMMMMMBBO..', ...DRG_FEET],
    { x: 13, y: 1, rows: ['...O..', '..OLO.', '.OLLLO', '..OLO.', '..OBO.', '.OBSO.', '.OBO..', 'OBSO..', 'OBO...', 'OO....'] },
    {
      sparkle: '#ffe9ff',
      back: awake(function (g, a, t) {
        const W = per(t, 1.4, 0.7) ? BWING_UP : BWING_DN;
        this.pattern(W, a.right - 1, a.neck - 11, DRG, false);
        this.pattern(mir(W), a.left - 9, a.neck - 11, DRG, false);
      }),
      mark: marks(horns(['..H', '.HH', 'HH.', 'Hh.', 'h..']), awake(function (g, a, t) {
        this.pattern(['.R.', 'RWR', '.R.'], a.hx - 1, a.top + 1, DRG);
        // 몇 초마다 불을 뿜는다
        const p = (t % 5) / 1.2;
        if (p < 1) {
          const len = Math.round(Math.sin(p * Math.PI) * 11);
          for (let i = 1; i <= len; i++) {
            const h = Math.min(3, 1 + Math.floor(i / 3)), fl = (Math.floor(t * 12) + i) % 2;
            for (let j = -h + fl; j <= h - fl; j++) this.px(a.left - 1 - i, a.my + 1 + j, Math.abs(j) < h - 1 ? (i < 4 ? FIRE.W : FIRE.Y) : FIRE.R, false);
          }
        } else snort.call(this, g, a, t);
      }), orbit('#ffb35a', 3, 14, 1.5)),
    },
  );

  Object.assign(S.STAGE, {
    cat: cheese1, cat2: cheese2, cat3: cheese3,
    puff: puffBase, puff2, puff3,
    scholar: scholarBase, scholar2, scholar3,
    weaver: weaverBase, weaver2, weaver3,
    owl: owlBase, owl2, owl3,
    dash: dashBase, dash2, dash3,
    star: starBase, star2, star3,
    twin: twin1, twin2, twin3,
    sprout: sprout1, sprout2, sprout3,
    tide: tide1, tide2, tide3,
    gear: gear1, gear2, gear3,
    dragon: dragon1, dragon2, dragon3,
  });
  S.STAGES = Object.keys(S.STAGE);
})(window);
