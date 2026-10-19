'use strict';
// [Plus] 복습 창 · 링크 정리 창 (옵시디언 모달). 노트 글은 setText 로만 넣는다 (HTML 로 그리지 않는다)
const { Modal, Setting, Notice } = require('obsidian');
const { grade } = require('../core/review');

const firstChar = (answers) => [...(answers[1] || answers[0])][0] || '';

class ReviewModal extends Modal {
  constructor(app, plugin, cards) {
    super(app);
    this.plugin = plugin;
    this.plus = plugin.plus;
    this.cards = cards;
    this.i = 0;
    this.right = 0;
    this.xp = 0;
  }

  t(k, v) {
    return this.plugin.host.T.t(k, v);
  }

  onOpen() {
    this.modalEl.addClass('vpp-modal');
    this.render();
  }

  onClose() {
    this.contentEl.empty();
    this.plus.finish(this.right, this.i);
  }

  render() {
    const el = this.contentEl;
    el.empty();
    this.hinted = false;
    if (!this.cards.length) {
      this.titleEl.setText(this.t('plus.cmdReview'));
      el.createEl('p', { text: this.t('plus.reviewEmpty') });
      return;
    }
    if (this.i >= this.cards.length) {
      el.createEl('p', { cls: 'vpp-result', text: this.t('plus.summary', { right: this.right, total: this.cards.length, xp: this.xp }) });
      new Setting(el).addButton((b) => b.setButtonText('OK').setCta().onClick(() => this.close()));
      return;
    }
    const c = this.cards[this.i];
    this.titleEl.setText(this.t('plus.reviewTitle', { i: this.i + 1, total: this.cards.length }));
    el.createEl('p', { cls: 'setting-item-description', text: this.t('plus.reviewFrom', { name: this.plugin.settings.get('petName') }) });
    el.createDiv({ cls: 'vpp-question', text: c.question });
    const hintEl = el.createEl('p', { cls: 'vpp-hint' });
    const input = el.createEl('input', { type: 'text', cls: 'vpp-input', attr: { placeholder: this.t('plus.placeholder') } });
    const row = new Setting(el);
    const snacks = this.plus.snackCount();
    row.addButton((b) => {
      b.setButtonText(snacks ? this.t('plus.hint', { n: snacks }) : this.t('plus.noSnack')).setDisabled(!snacks);
      b.onClick(() => {
        if (this.hinted || !this.plus.hint()) return;
        this.hinted = true;
        hintEl.setText(this.t('plus.hintShown', { c: firstChar(c.answers) }));
        b.setDisabled(true);
        input.focus();
      });
    });
    row.addButton((b) => b.setButtonText(this.t('plus.submit')).setCta().onClick(() => this.check(input.value)));
    // 중국어 입력기로 글자를 고르는 중(조합 중)에 누른 Enter 는 답이 아니다
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      this.check(input.value);
    });
    input.focus();
  }

  check(value) {
    const c = this.cards[this.i];
    const g = grade(value, c.answers);
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
    const xp = this.plus.answer(c.key, result, this.hinted);
    if (result === 'right') this.right++;
    this.xp += xp;
    const el = this.contentEl;
    el.querySelectorAll('.setting-item, .vpp-input, .vpp-result').forEach((x) => x.remove());
    el.createEl('p', { cls: `vpp-result vpp-${result}`, text: result === 'right' ? `${this.t('plus.right', { xp })} · ${c.answers[0]}` : this.t('plus.wrong', { answer: c.answers[0] }) });
    this.i++;
    const next = () => this.render();
    new Setting(el)
      .addButton((b) =>
        b.setButtonText(this.t('plus.open')).onClick(() => {
          this.close();
          this.app.workspace.openLinkText(c.path, '', false);
        }),
      )
      .addButton((b) => {
        b.setButtonText(this.t('plus.next')).setCta().onClick(next);
        window.setTimeout(() => b.buttonEl.focus(), 0);
      });
  }
}

class TidyModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
    this.plus = plugin.plus;
  }

  t(k, v) {
    return this.plugin.host.T.t(k, v);
  }

  onOpen() {
    this.modalEl.addClass('vpp-modal');
    this.titleEl.setText(this.t('plus.tidyTitle'));
    this.render();
  }

  onClose() {
    this.contentEl.empty();
  }

  async render() {
    const list = await this.plus.mentions();
    const el = this.contentEl;
    el.empty();
    if (!list.length) {
      el.createEl('p', { text: this.t('plus.tidyEmpty') });
      return;
    }
    el.createEl('p', { cls: 'setting-item-description', text: this.t('plus.tidyIntro') });
    for (const m of list) {
      const box = el.createDiv({ cls: 'vpp-tidy' });
      box.createEl('b', { text: m.path.replace(/\.md$/, '') });
      box.createDiv({ cls: 'vpp-diff vpp-before', text: m.before });
      box.createDiv({ cls: 'vpp-diff vpp-after', text: m.after });
      new Setting(box).addButton((b) =>
        b
          .setButtonText(this.t('plus.tidyApply'))
          .setCta()
          .onClick(async () => {
            b.setDisabled(true);
            if (!(await this.plus.applyTidy(m))) new Notice(this.t('plus.tidyChanged'));
            this.render();
          }),
      );
    }
  }
}

module.exports = { ReviewModal, TidyModal };
