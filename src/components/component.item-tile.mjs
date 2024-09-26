
/**
 * @file A custom element that represents an Ability Score and its modifier
 */

import BaseElement from "./component.utils.base-component.mjs"
import { component } from "./component.utils.decorators.mjs"
import styles from "./component.item-tile.css" with { type: "css" }
import html from "../utils/html.mjs"

@component("uft-item-tile")
class ItemTile extends BaseElement {
  static get styles() {
    return [styles];
  }

  document;

  async prepareData() {
    if (this.uuid)
      this.document = await fromUuid(this.uuid);
  }

  async #buildTooltipTemplate(level) {
    const template = document.createElement("template");
    const tooltip = await this.tooltip;
    const banner = this.document.system.banner
      ? html`<img src="${this.document.system.banner}" class="banner" alt="" />`
      : "";

    template.innerHTML = html`
      <header>
        ${banner}
        <h1>${this.document.name}</h1>
      </header>
      ${tooltip}
    `;
    return template.content.firstElementChild;
  }

  events() {
   this.addEventListener("mouseover", this.#onMouseOver.bind(this));
   this.addEventListener("mouseout", this.#onMouseOut.bind(this));
  }

  get uuid() {
    return this.getAttribute("uuid");
  }
  get src() {
    return this.getAttribute("src");
  }
  get tooltip() {
    return this.document?.sheet?.tooltip || "";
  }

  get template() {
    if (!this.document || !this.src) return "";
    return html`<img src="${this.src}" alt="${this.document.name}" />`;
  }

  async #onMouseOver(e) {
    e.stopPropagation();
    const content = await this.#buildTooltipTemplate();
    game.tooltip.activate(this, {
      content,
      cssClass: "tooltip--enriched-tooltip"
    })
  }

  #onMouseOut(e) {
    game.tooltip.deactivate();
  }
}

export default ItemTile;
