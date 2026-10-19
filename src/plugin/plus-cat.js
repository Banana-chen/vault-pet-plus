'use strict';
/*
 * [Plus] 복습 창 안의 고양이. 펫 창과 같은 그림(kit/sprite.js · motions · 꾸미기)을 숨은 iframe 하나에 불러 쓴다.
 * iframe 이라 PetSprite 같은 전역 이름이 옵시디언 창과 섞이지 않는다 (frame.js 와 같은 이유). 처음 열 때 한 번만 불러 둔다.
 */
const ASSETS = require('./kit-assets');

// 복습 창에서 쓰는 동작 (sprite.js ACTION_LEN · motions.js 의 이름)
const ACT = { bite: 'nibble', right: 'hooray', wrong: 'melt', close: 'fishthink', hint: 'nibble' };
const TICK_MS = 70; // 하우스 창 animate() 와 같은 간격

let kit = null;

// 못 불러오면 iframe 을 치우고 던진다 (다음 카드에서 다시 해 본다, iframe 이 쌓이지 않게)
function loadKit(plugin) {
  if (kit) return kit;
  const frame = document.body.createEl('iframe', { cls: 'vpp-kit', attr: { 'aria-hidden': 'true', tabindex: '-1' } });
  try {
    const win = frame.contentWindow;
    ASSETS.run(win, win.document, null, 'sprite');
    if (!win.PetSprite) throw new Error('PetSprite missing');
    kit = win.PetSprite;
  } catch (e) {
    frame.remove();
    throw e;
  }
  plugin.register(() => {
    frame.remove();
    kit = null;
  });
  return kit;
}

// look = { stage, fur, ears, accessory } 를 주면 그 고양이를 (길고양이), 없으면 데려온 고양이를 그린다
class ModalCat {
  constructor(plugin, parent, look = null) {
    const s = plugin.settings;
    this.canvas = parent.createEl('canvas', { cls: 'vpp-cat' });
    this.timer = null;
    try {
      const r = new (loadKit(plugin).PetRenderer)(this.canvas);
      const L = look || { stage: (plugin.host.growth && plugin.host.growth.stageKey) || 'cat', accessory: s.get('accessory'), fur: s.get('fur'), ears: s.get('ears') };
      r.setStage(L.stage);
      r.setAccessory(L.accessory || 'none');
      r.setFur(L.fur);
      r.setEars(L.ears);
      r.setMood('idle');
      this.r = r;
      r.frame();
      // 저전력이면 한 장만 그리고 움직이지 않는다
      if (!s.get('lowPower')) this.loop();
    } catch (e) {
      // 고양이를 못 그려도 문제는 풀 수 있어야 한다
      console.error('[Vault Pet Plus] cat', e);
      this.canvas.remove();
      this.r = null;
    }
  }

  loop() {
    this.r.frame();
    this.timer = window.setTimeout(() => this.loop(), TICK_MS);
  }

  act(kind) {
    if (this.r && ACT[kind]) this.r.play(ACT[kind]);
  }

  destroy() {
    window.clearTimeout(this.timer);
    this.r = null;
  }
}

module.exports = { ModalCat };
