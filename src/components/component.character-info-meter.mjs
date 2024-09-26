/**
 * @file A custom element that represents a value with a minimum and a maximum.
 */
import BaseElement from "../base-component.mjs";
// @ts-expect-error
import styles from "./CharacterInfoMeter.css" with { type: "css" }
import { component } from "../decorators.mjs";

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
    return (this.#value / this.#max) * 100 || 0;
  }

  /**
   *
   */
  get template() {
    return /*html*/ `
      <slot name="icon"></slot>
      <div class="meter" style="--meter-fill-pct: ${this.#progress}%"></div>
      <slot></slot>
      <span class="value">${this.#value}/${this.#max}</span>
    `;
  }
}
