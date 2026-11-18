'use strict';
// [Plus] 카드 잇기 창 · 링크 정리 창 (옵시디언 모달). 노트 글은 setText 로만 넣는다 (HTML 로 그리지 않는다)
const { Modal, Setting, Notice } = require('obsidian');
const { ModalCat } = require('./plus-cat');

// 카드 한 장: 제목과 첫 단락 (가리지 않는다). 글은 setText 로만 넣는다
function drawCard(parent, c) {
  const box = parent.createDiv({ cls: 'vpp-question' });
  box.createDiv({ cls: 'vpp-title', text: c.title });
  if (c.question) box.appendText(c.question);
  return box;
}

// 카드 잇기: 옛 카드를 다시 보고, 이을 만한 카드 중에 고르고 이유를 적어 잇는다 (이유는 꼭). 맞고 틀림이 없다
class ReviewModal extends Modal {
  constructor(app, plugin, cards) {
    super(app);
    this.plugin = plugin;
    this.plus = plugin.plus;
    this.cards = cards;
    this.i = 0;
    this.links = 0;
    this.xp = 0;
    this.reasons = []; // 이번에 적은 이유 { from, to, reason } (끝에 모아 보여 준다)
  }

  t(k, v) {
    return this.plugin.host.T.t(k, v);
  }

  onOpen() {
    this.modalEl.addClass('vpp-modal');
    this.modalEl.toggleClass('vpp-still', !!this.plugin.settings.get('lowPower'));
    this.render();
  }

  onClose() {
    if (this.cat) this.cat.destroy();
    this.contentEl.empty();
    // 이어 놓고 '다음'을 안 누른 채 닫아도 그 카드는 본 것으로 (다음 상자로)
    if (this.linkedHere > 0 && this.i < this.cards.length) this.done(this.cards[this.i]);
    this.plus.finish(this.links, this.i);
  }

  // 카드 한 장을 다 봤다: 다음 상자로
  done(c) {
    this.plus.visit(c.key);
    this.linkedHere = 0;
    this.countedHere = false;
    this.i++;
  }

  render() {
    const el = this.contentEl;
    el.empty();
    if (this.cat) this.cat.destroy();
    this.cat = null;
    if (!this.cards.length) {
      this.titleEl.setText(this.t('plus.cmdReview'));
      el.createEl('p', { text: this.t('plus.reviewEmpty') });
      return;
    }
    if (this.i >= this.cards.length) {
      this.titleEl.setText(this.t('plus.cmdReview'));
      el.createEl('p', { cls: 'vpp-result', text: this.t('plus.summary', { total: this.cards.length, links: this.links, xp: this.xp }) });
      // 이번에 적은 이유들: 오늘 생각해 낸 것
      if (this.reasons.length) {
        el.createEl('p', { cls: 'setting-item-description', text: this.t('plus.reasonsTitle') });
        const list = el.createEl('ul', { cls: 'vpp-reasons' });
        for (const x of this.reasons) list.createEl('li', { text: `${x.from} → ${x.to}：${x.reason}` });
      }
      new Setting(el).addButton((b) => b.setButtonText('OK').setCta().onClick(() => this.close()));
      return;
    }
    const c = this.cards[this.i];
    this.linkedHere = 0;
    this.countedHere = false; // 이 카드를 '이은 카드'로 셌는지 (잇기를 기다리는 사이에 또 눌러도 한 번만)
    this.shown = c.candidates.map((x) => x.path);
    this.titleEl.setText(this.t('plus.reviewTitle', { i: this.i + 1, total: this.cards.length }));
    const stage = el.createDiv({ cls: 'vpp-stage' });
    this.cat = new ModalCat(this.plugin, stage);
    stage.createEl('p', { cls: 'setting-item-description', text: this.t('plus.reviewFrom', { name: this.plugin.settings.get('petName') }) });
    drawCard(el, c);
    el.createEl('p', { cls: 'vpp-why', text: this.t('plus.linked', { n: c.linked }) });
    this.listEl = el.createDiv();
    this.drawCandidates(c, c.candidates);
    new Setting(el)
      .addButton((b) =>
        b.setButtonText(this.t('plus.open')).onClick(() => {
          this.done(c);
          this.close();
          this.app.workspace.openLinkText(c.path, '', false);
        }),
      )
      .addButton((b) =>
        b.setButtonText(this.t('plus.reshuffle')).onClick(() => {
          const more = c.more(this.shown);
          this.shown.push(...more.map((x) => x.path));
          this.drawCandidates(c, more);
        }),
      )
      .addButton((b) =>
        b.setButtonText(this.t('plus.next')).setCta().onClick(() => {
          this.done(c);
          this.render();
        }),
      );
  }

  drawCandidates(c, list) {
    const el = this.listEl;
    el.empty();
    if (!list.length) el.createEl('p', { cls: 'vpp-why', text: this.t('plus.noCands') });
    for (const o of list) {
      const box = el.createDiv({ cls: 'vpp-tidy vpp-cand' });
      box.createEl('b', { text: o.title });
      box.createDiv({ cls: 'vpp-why', text: this.t('plus.why.' + o.why, { via: o.via }) });
      if (o.excerpt) box.createDiv({ cls: 'vpp-excerpt', text: o.excerpt });
      const row = new Setting(box);
      row.addButton((b) => b.setButtonText(this.t('plus.connect')).onClick(() => this.askReason(c, o, box, row)));
    }
  }

  // 이은 뒤: 노트에 쓴 줄 · 이제 몇 장과 이어졌는지 · 다음 단계까지 · 이유를 새 카드로
  showResult(c, o, box, reason, res) {
    box.createEl('p', { cls: 'vpp-result vpp-right', text: res.xp ? this.t('plus.connected', { xp: res.xp }) : this.t('plus.connectedNoXp') });
    box.createDiv({ cls: 'vpp-line', text: res.line });
    const notes = [this.t('plus.linkedNow', { n: c.linked + this.linkedHere })];
    if (res.connectionsLeft !== null) {
      notes.push(res.connectionsLeft > 0 ? this.t('plus.left', { n: res.connectionsLeft, stage: res.nextStage }) : this.t('plus.ready', { stage: res.nextStage }));
    }
    box.createDiv({ cls: 'vpp-why', text: notes.join(' · ') });
    const row = new Setting(box).addButton((b) =>
      b.setButtonText(this.t('plus.newCard')).onClick(async () => {
        b.setDisabled(true);
        const f = await this.plus.writeCard(c.path, o.path, reason);
        row.settingEl.remove();
        if (!f) {
          box.createEl('p', { cls: 'vpp-result vpp-wrong', text: this.t('plus.cardFail') });
          return;
        }
        const made = box.createEl('p', { cls: 'vpp-result vpp-right' });
        made.createEl('a', { text: this.t('plus.cardMade', { title: f.basename }), href: '#' }).addEventListener('click', (e) => {
          e.preventDefault();
          this.app.workspace.openLinkText(f.path, '', true);
        });
      }),
    );
  }

  // 왜 이어지는지 한 줄 (비우면 잇지 않는다). 이유를 적는 것이 이 복습의 알맹이고, 길들이기 문제로 다시 나온다
  askReason(c, o, box, row) {
    row.settingEl.remove();
    const input = box.createEl('input', { type: 'text', cls: 'vpp-input', attr: { placeholder: this.t('plus.reason') } });
    const go = async () => {
      if (!input.value.trim()) {
        input.addClass('vpp-need');
        input.focus();
        return;
      }
      input.disabled = true;
      const reason = input.value.trim();
      const countCard = !this.countedHere;
      this.countedHere = true;
      const res = await this.plus.connect(c.path, o.title, reason, countCard);
      input.remove();
      act.settingEl.remove();
      if (res === null) {
        if (countCard) this.countedHere = false;
        box.createEl('p', { cls: 'vpp-result vpp-wrong', text: this.t('plus.connectFail') });
        return;
      }
      this.links++;
      this.linkedHere++;
      this.xp += res.xp;
      this.reasons.push({ from: c.title, to: o.title, reason });
      if (this.cat) this.cat.act('right');
      this.showResult(c, o, box, reason, res);
    };
    const act = new Setting(box).addButton((b) => b.setButtonText(this.t('plus.connect')).setCta().onClick(go));
    // 중국어 입력기로 글자를 고르는 중(조합 중)에 누른 Enter 는 확인이 아니다
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || e.isComposing) return;
      e.preventDefault();
      go();
    });
    input.focus();
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

module.exports = { ReviewModal, TidyModal, drawCard };
