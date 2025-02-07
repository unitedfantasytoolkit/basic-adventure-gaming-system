/**
 * @file A custom element that represents a value with a minimum and a maximum.
 */
import BaseElement from "./component.utils.base-component.mjs"
import { component } from "./component.utils.decorators.mjs"
import html from "../utils/html.mjs"
import styles from "./component.character-info-meter.css" with { type: "css" }

@component("uft-character-info-meter")
export default class CharacterInfoMeter extends BaseElement {
  static get styles() {
    return [styles];
  }

  get #value() {
    const value = parseInt(this.getAttribute("value") || "");
    if (isNaN(value)) return 0;
    return value;
  }

  get #max() {
    const max = parseInt(this.getAttribute("max") || "");
    if (isNaN(max)) return 100;
    return max;
  }

  get #progress() {
    const pct = (this.#value / this.#max) * 100 || 0;
    if (pct < 0) return 0
    if (pct > 100) return 100;
    return pct;
  }

  /**
   *
   */
  get template() {
    const meterClasses = ["meter"];
    if (this.#progress === 0) meterClasses.push("meter--empty");
    if (this.#progress === 100) meterClasses.push("meter--full");
    return html`
      <div class="icon">
        <slot name="icon"></slot>
      </div>
      <div class="${meterClasses.join(" ")}" style="--meter-fill-pct: ${this.#progress}%">
        <span class="value">${this.#value}/${this.#max}</span>
      </div>
    `;
  }
}

