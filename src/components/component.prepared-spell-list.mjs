/**
 * @file A custom element that represents an Ability Score and its modifier
 */

import BaseElement from "./component.utils.base-component.mjs"
import { component } from "./component.utils.decorators.mjs"
import styles from "./component.prepared-spell-list.css" with { type: "css" };
import html from "../utils/html.mjs";

@component("uft-prepared-spells")
export default class ExpandableSection extends BaseElement {
  static get styles() {
    return [styles];
  }

  owner;
  level;

  async prepareData() {
    if (this.closest("form[data-uuid]"))
      this.owner = await fromUuid(
        this.closest("form[data-uuid]")?.dataset?.uuid || "",
      );
  }

  #selectSpells(level) {
    return this.owner?.system.spells.prepared[level - 1];
  }

  #buildLevelTemplate(level) {
    const spells = this.#selectSpells(level);

    const slots = spells.map(this.#buildSlotTemplate)?.join("") || [];

    return html`
      <li class="spell-level">
        <span
          class="spell-level__level"
          part="level"
        >
          ${!this.hasAttribute("level")
            ? `<uft-tag-chip>${level}</uft-tag-chip>`
            : ""}
        </span>
        <ul class="spell-slots">
          ${slots}
        </ul>
      </li>
    `;
  }

  #buildSlotTemplate(spell) {
    if (spell)
      return html`
        <li
          class="spell-slot"
          aria-label="${spell.name}"
          title="${spell.name}"
          id="${spell.id}"
        >
          <img
            src="${spell.img}"
            alt=""
            class="spell-slot__icon"
          />
        </li>
      `;
    return /*html*/ `
      <li class="spell-slot empty"></li>
    `;
  }

  events() {
    const slots = Array.from(
      this.shadowRoot?.querySelectorAll(".spell-slot:not(.empty)") || [],
    );

    if (slots)
      slots.forEach((slot) =>
        slot.addEventListener("pointerdown", this.#onCast.bind(this)),
      );
  }

  get template() {
    if (!this.owner?.system.spells?.prepared?.length) return "";

    const level = this.getAttribute("level");

    const spellLevels = level
      ? [parseInt(level, 10)]
      : this.owner?.system.spells.prepared.map((_s, idx) => idx + 1);

    return html`
      <ul class="spell-levels">
        ${spellLevels.map(this.#buildLevelTemplate.bind(this))?.join("")}
      </ul>
    `;
  }

  /**
   * Let the sheet determine what creating an item means
   */
  #onCast(e) {
    e.stopPropagation();
    const id = e.target?.closest(".spell-slot")?.id || "";
    const spell = this.owner?.items.get(id);
    if (spell) spell.roll();
  }
}
