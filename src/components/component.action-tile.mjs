/**
 * @file A custom element that represents an Ability Score and its modifier
 */

import BaseElement from "./component.utils.base-component.mjs"
import { component } from "./component.utils.decorators.mjs"
import styles from "./component.action-tile.css" with { type: "css" }
import html from "../utils/html.mjs"

@component("bags-action-tile")
class ItemTile extends BaseElement {
  static get styles() {
    return [styles]
  }

  document

  action

  async prepareData() {
    if (this.uuid) this.document = await fromUuid(this.uuid)
  }

  async #buildTooltipTemplate() {
    const template = document.createElement("template")
    const banner = this.action.img
      ? html`<img
          src="${this.action.img}"
          class="banner"
          alt=""
        />`
      : ""

    template.innerHTML = html`
      <header>
        ${banner}
        <h1>${this.action.name}</h1>
      </header>
      <main>${this.action.description || ""}</main>
    `
    return template.content.firstElementChild
  }

  events() {
    this.addEventListener("mouseover", this.#onMouseOver.bind(this))
    this.addEventListener("mouseout", this.#onMouseOut.bind(this))
  }

  get uuid() {
    return this.getAttribute("uuid")
  }

  get src() {
    return this.getAttribute("src")
  }

  get tooltip() {
    return this.document?.system?.tooltip || ""
  }

  get template() {
    if (!this.document) return ""
    return html`<img
      src="${this.document.img}"
      alt="${this.document.name}"
    />`
  }

  async #onMouseOver(e) {
    e.stopPropagation()
    const content = await this.#buildTooltipTemplate()
    game.tooltip.activate(this, {
      content,
      cssClass: "tooltip--enriched tooltip--action",
    })
  }

  #onMouseOut() {
    game.tooltip.deactivate()
  }
}

export default ItemTile
