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
    return [styles]
  }

  document

  async prepareData() {
    if (this.uuid) this.document = await fromUuid(this.uuid)
  }

  async #buildTooltipTemplate(level) {
    const template = document.createElement("template")

    template.innerHTML = html`<div class="tooltip__container">
      ${this.tooltipHeader}
      <hr />
      ${this.#tooltipLogistics} ${this.tooltipContent} ${this.tooltipFooter}
    </div>`
    return template.content.firstElementChild
  }

  events() {
    this.addEventListener("mouseover", this.#onMouseOver.bind(this))
    this.addEventListener("mouseout", this.#onMouseOut.bind(this))
    this.addEventListener("click", this.#onClick.bind(this))
    // this.addEventListener("contextmenu", this.#onContextMenu.bind(this))
  }

  get uuid() {
    return this.getAttribute("uuid")
  }

  get src() {
    return this.getAttribute("src")
  }

  get tooltipHeader() {
    const banner = this.document?.system?.banner
      ? html`<img
          src="${this.document.system.banner}"
          class="banner"
          alt=""
        />`
      : ""
    return `
      <header>
        ${banner}
        <h1>${this.document.name}</h1>
      </header>
    `
  }

  get tooltipContent() {
    return this.document?.tooltipHTML.body
      ? `<main>${this.document.tooltipHTML.body}</main>`
      : ""
  }

  /**
   * @todo What else goes in the footer?
   */
  get tooltipFooter() {
    if (!this.document?.tooltipHTML.controls) return ""

    return `<footer>${this.#tooltipControls}</footer>`
  }

  get #tooltipControls() {
    return this.document?.tooltipHTML.controls || ""
  }

  get #tooltipLogistics() {
    return this.document?.tooltipHTML.logistics || ""
  }

  get template() {
    if (!this.document) return ""
    const img = html`<img
      src="${this.document.img}"
      alt="${this.document.name}"
    />`
    const { quantity } = this.document.system
    const quantityLabel =
      typeof quantity === "number" && quantity > 1
        ? html`<span class="quantity">${quantity}</span>`
        : ""

    return `${img}${quantityLabel}`
  }

  async #onClick(e) {
    this.document?.sheet.render(true)
  }

  async #onContextMenu(e) {
    console.info(this.document.system.constructor.TILE_CONTEXT_OPTIONS)
  }

  async #onMouseOver(e) {
    e.stopPropagation()
    const content = await this.#buildTooltipTemplate()
    game.tooltip.activate(this, {
      content,
      cssClass: "tooltip--enriched-tooltip",
    })
  }

  #onMouseOut() {
    game.tooltip.deactivate()
  }
}

export default ItemTile
