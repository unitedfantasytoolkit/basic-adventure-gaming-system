/**
 * @file A custom element that represents a character class and its XP bar.
 */
import BaseElement from "./component.utils.base-component.mjs"
import { component } from "./component.utils.decorators.mjs"
import html from "../utils/html.mjs"
import styles from "./component.xp-bar.css" with { type: "css" }

@component("uft-xp-bar")
export default class XPBar extends BaseElement {
  static get styles() {
    return [styles];
  }

  item;

  async prepareData() {
    if (this.getAttribute("uuid"))
      this.item = await fromUuid(this.getAttribute("uuid"));
  }

  get #name() {
    return this.item.name;
  }

  get #level() {
    return this.item.system.level;
  }

  get #value() {
    return this.item.system.xp;
  }

  get #max() {
    return this.item.system.xpTable[this.#level - 1].value;
  }

  get #min() {
    if (this.#level === 1) return 0;
    return this.item.system.xpTable[this.#level - 2].value || 0;
  }

  get #progress() {
    return (this.#value / this.#max) * 100 || 0;
  }

  /**
   *
   */
  get template() {
    return /*html*/ `
      
      <svg viewBox="0 0 64 64" class="circular-progress" style="--progress: ${this.#progress}">
        <circle class="bg"></circle>
        <circle class="fg"></circle>
        <image href="${this.item.img}" preserveAspectRatio="xMinYMin" />
      </svg>
      <div class="details">
        <span class="name">${this.#name}</span>
        <span class="value">${this.#value}/${this.#max}</span>
      </div>      
    `;
  }
}
