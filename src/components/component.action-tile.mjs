/**
 * @file A custom element that represents a single Action as a clickable tile.
 *
 * Actions are not documents. They live inside an Item's (or an Actor's) schema,
 * so there is nothing to hand `uft-item-tile` and nothing with a sheet to open.
 * This is the equivalent widget for them: point it at the document that owns the
 * action and the action's id, and it renders the icon with an enriched tooltip
 * describing what using it would do.
 *
 * The tile does not resolve the action itself. It carries `data-action` and lets
 * the sheet's own click handling take over, which is how every other action
 * control in the system works and keeps the "what happens when you use this"
 * question in one place.
 */

import BaseElement from "./component.utils.base-component.mjs"
import { component } from "./component.utils.decorators.mjs"
import styles from "./component.action-tile.css" with { type: "css" }
import html from "../utils/html.mjs"

@component("bags-action-tile")
class ActionTile extends BaseElement {
  static get styles() {
    return [styles]
  }

  /** @type {Item|Actor|null} The document the action belongs to */
  document

  /** @type {object|null} The action itself */
  action

  async prepareData() {
    if (!this.uuid) return

    this.document = await fromUuid(this.uuid)

    // Items expose `actionList`, which includes anything the item assembles on
    // the fly -- a weapon's default attack. Actors only ever have `actions`.
    const actions =
      this.document?.system?.actionList ?? this.document?.system?.actions ?? []

    this.action = actions.find(({ id }) => id === this.actionId) ?? null
  }

  get uuid() {
    return this.getAttribute("uuid")
  }

  get actionId() {
    return this.getAttribute("action-id")
  }

  /**
   * Whether this action has been used up for now.
   *
   * Set by whoever renders the tile rather than worked out here, so the sheet
   * and the tile can't come to different conclusions about the same action.
   * @returns {boolean} Whether the tile should read as spent
   */
  get isExhausted() {
    return this.hasAttribute("exhausted")
  }

  get template() {
    if (!this.action) return ""

    return html`<img
      src="${this.action.img}"
      alt="${this.action.name}"
    />`
  }

  events() {
    this.addEventListener("mouseover", this.#onMouseOver.bind(this))
    this.addEventListener("mouseout", this.#onMouseOut.bind(this))
    this.addEventListener("keydown", this.#onKeyDown.bind(this))

    // The sheet finds this by `data-action`, and a bare custom element is not
    // focusable or announced as anything. Setting it here rather than in the
    // template keeps every caller from having to remember it.
    if (this.action) {
      this.setAttribute("role", "button")
      this.setAttribute("tabindex", "0")
      this.setAttribute("aria-label", this.action.name)

      // Spent, not disabled: clicking is still how you find out why it won't
      // go, because the resolver names the action and its charges when it
      // refuses.
      if (this.isExhausted) this.setAttribute("aria-disabled", "true")
    }
  }

  /**
   * The tooltip's contents: what the action is, where it came from, and what it
   * does.
   *
   * Built to the same shape as an item's tooltip -- header, rule, stat line,
   * body -- so the two read as the same kind of thing when they sit next to
   * each other on the same tab.
   * @returns {HTMLElement} The tooltip's root element
   */
  #buildTooltip() {
    const template = document.createElement("template")

    template.innerHTML = html`<div class="tooltip__container">
      <header>
        <h1>${this.action.name}</h1>
      </header>
      <hr />
      <dl class="item-stats">${this.#tooltipStats}</dl>
      <main>${this.action.description || ""}</main>
      <footer>
        <span
          ><i
            class="iconoir-mouse-button-left"
            aria-label="Left click"
          ></i>
          ${ActionTile.localize("BAGS.Actors.Common.Actions.Use")}</span
        >
      </footer>
    </div>`

    return template.content.firstElementChild
  }

  /**
   * The stat line under the tooltip's heading.
   *
   * Always names the source, because the abilities grid mixes actions from a
   * class, an ancestry and loose abilities, and the icon alone rarely says which
   * is which. Remaining uses are shown only when the action is actually limited.
   * @returns {string} Definition list markup
   */
  get #tooltipStats() {
    const source = html`<dt>
        <i
          class="fa fa-bookmark"
          aria-label="Source"
        ></i>
      </dt>
      <dd>${this.document.name}</dd>`

    const { uses } = this.action
    if (!uses?.max) return source

    return html`${source}
      <dt>
        <i
          class="fa fa-bolt"
          aria-label="Uses remaining"
        ></i>
      </dt>
      <dd>${uses.value ?? 0}/${uses.max}</dd>`
  }

  #onMouseOver(e) {
    if (!this.action) return

    e.stopPropagation()
    game.tooltip.activate(this, {
      content: this.#buildTooltip(),
      cssClass: "tooltip--enriched-tooltip",
    })
  }

  #onMouseOut() {
    game.tooltip.deactivate()
  }

  /**
   * Let the keyboard do what the mouse does.
   *
   * `click()` rather than resolving anything directly, so the sheet's own
   * `data-action` handling stays the single way an action gets used.
   * @param {KeyboardEvent} e - The keydown event
   */
  #onKeyDown(e) {
    if (e.key !== "Enter" && e.key !== " ") return

    e.preventDefault()
    this.click()
  }
}

export default ActionTile
