'use strict';
// [Plus] 길들이기 창: 먹이 하나 주기 → 복습 문제 셋 → (안 보이는) 주사위 → 이름 짓기.
// 확률은 보여 주지 않고, 맞힐 때마다 "조금 편해 보인다" 같은 말만 한다. 먹이를 준 뒤 창을 닫으면 달아난다
const { Modal, Setting, Notice } = require('obsidian');
const { grade } = require('../core/review');
const { tameChance } = require('../core/collection');
const { breedOf } = require('../core/breeds');
const { FOODS } = require('../core/shop');
const { ModalCat } = require('./plus-cat');
const { drawQuestion, giveBack } = require('./plus-modals');

const QUESTIONS = 3;

class TameModal extends Modal {
  constructor(app, plugin, stray, cards) {
    super(app);
    this.plugin = plugin;
    this.collect = plugin.collect;
    this.breed = breedOf(stray.breed);
    this.cards = cards.slice(0, QUESTIONS);
    this.i = 0;
    this.correct = 0;
    this.food = null;
    this.done = false;
  }

  t(k, v) {
    return this.plugin.host.T.t(k, v);
  }

  onOpen() {
    this.modalEl.addClass('vpp-modal');
    this.modalEl.toggleClass('vpp-still', !!this.plugin.settings.get('lowPower'));
    this.titleEl.setText(this.t('tame.title'));
    this.renderFood();
  }

  onClose() {
    if (this.cat) this.cat.destroy();
    this.contentEl.empty();
    // 먹이를 받고 문제 도중에 닫으면 겁먹고 달아난다. 길들인 뒤 이름을 안 짓고 닫으면 기본 이름으로 도감에
    if (this.food && !this.done) this.collect.runAway();
    if (this.won && !this.saved) this.adopt(null, false);
  }

  // 위쪽: 길고양이 그림 + 한 줄
  head(text) {
    const el = this.contentEl;
    el.empty();
    if (this.cat) this.cat.destroy();
    const stage = el.createDiv({ cls: 'vpp-stage' });
    const b = this.breed;
    this.cat = new ModalCat(this.plugin, stage, { stage: b.stages[0].key, fur: b.fur, ears: b.ears });
    stage.createEl('p', { cls: 'setting-item-description', text });
    return el;
  }

  renderFood() {
    const el = this.head(this.t('tame.intro'));
    const shop = this.plugin.host.shop;
    const have = FOODS.filter((f) => shop.stock(f.key) > 0).sort((a, b) => a.price - b.price);
    if (!have.length) {
      el.createEl('p', { text: this.t('tame.noFood') });
      return;
    }
    el.createEl('p', { text: this.t('tame.pickFood') });
    const row = el.createDiv({ cls: 'vpp-foods' });
    for (const f of have) {
      const b = row.createEl('button', { text: `${this.t('item.' + f.key)} ×${shop.stock(f.key)}` });
      b.addEventListener('click', () => this.feed(f));
    }
  }

  feed(f) {
    if (!this.plugin.host.shop.useFood(f.key)) return;
    this.food = f;
    this.plugin.host.pushHouse();
    if (!this.cards.length) return this.roll();
    this.cat.act('bite');
    this.renderQuestion(this.t('tame.ate', { food: this.t('item.' + f.key) }));
  }

  renderQuestion(text) {
    const c = this.cards[this.i];
    const el = this.head(text || this.t('tame.mood' + Math.min(this.correct, 3)));
    el.createEl('p', { cls: 'setting-item-description', text: this.t('tame.q', { i: this.i + 1, total: this.cards.length }) });
    this.qEl = drawQuestion(el, c);
    const input = el.createEl('input', { type: 'text', cls: 'vpp-input', attr: { placeholder: this.t('plus.placeholder') } });
    new Setting(el).addButton((b) => b.setButtonText(this.t('plus.submit')).setCta().onClick(() => this.check(input.value)));
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      this.check(input.value);
    });
    input.focus();
  }

  check(value) {
    const c = this.cards[this.i];
    const g = grade(value, c.answers, c.loose);
    if (g !== 'close') return this.settle(g);
    const el = this.contentEl;
    el.querySelectorAll('.setting-item, .vpp-input').forEach((x) => x.remove());
    el.createEl('p', { cls: 'vpp-result', text: this.t('plus.close', { answer: c.answers[0] }) });
    new Setting(el)
      .addButton((b) => b.setButtonText(this.t('plus.markWrong')).onClick(() => this.settle('wrong')))
      .addButton((b) => b.setButtonText(this.t('plus.markRight')).setCta().onClick(() => this.settle('right')));
  }

  settle(result) {
    const c = this.cards[this.i];
    this.plugin.plus.practice(result);
    if (result === 'right') this.correct++;
    giveBack(this.qEl, c.kind === 'title' ? [c.answers[0], ...c.bites] : c.bites, result);
    this.cat.act(result);
    const el = this.contentEl;
    el.querySelectorAll('.setting-item, .vpp-input, .vpp-result').forEach((x) => x.remove());
    el.createEl('p', { cls: `vpp-result vpp-${result}`, text: result === 'right' ? this.t('tame.right') : this.t('tame.wrong', { answer: c.answers[0] }) });
    this.i++;
    const last = this.i >= this.cards.length;
    new Setting(el).addButton((b) => {
      b.setButtonText(this.t(last ? 'tame.reach' : 'plus.next')).setCta().onClick(() => (last ? this.roll() : this.renderQuestion()));
      window.setTimeout(() => b.buttonEl.focus(), 0);
    });
  }

  roll() {
    const p = tameChance({ correct: this.correct, price: this.food.price, rarity: this.breed.rarity });
    this.done = true;
    if (Math.random() >= p) {
      this.collect.runAway();
      const el = this.head(this.t('tame.fail'));
      this.cat.act('wrong');
      el.createEl('p', { text: this.t('tame.failSub') });
      new Setting(el).addButton((b) => b.setButtonText('OK').onClick(() => this.close()));
      return;
    }
    this.won = true;
    this.renderName();
  }

  adopt(name, bring) {
    this.saved = true;
    const nm = (name || '').trim() || this.t('breed.' + this.breed.key);
    this.collect.adopt(this.breed.key, nm);
    if (bring) this.collect.switchTo(this.breed.key);
    const host = this.plugin.host;
    host.pushHouse();
    host.bubble(host.T.line('tameWin', { name: nm }), 'grow', 'cats');
    new Notice(this.t('tame.saved', { name: nm }));
  }

  renderName() {
    const el = this.head(this.t('tame.win'));
    this.cat.act('right');
    el.createEl('p', { text: this.t('tame.nameIt') });
    const input = el.createEl('input', { type: 'text', cls: 'vpp-input', value: this.t('breed.' + this.breed.key), attr: { maxlength: 12 } });
    const save = (bring) => {
      this.adopt(input.value, bring);
      this.close();
    };
    new Setting(el)
      .addButton((b) => b.setButtonText(this.t('tame.keep')).onClick(() => save(false)))
      .addButton((b) => b.setButtonText(this.t('tame.bring')).setCta().onClick(() => save(true)));
    input.select();
  }
}

module.exports = { TameModal };
