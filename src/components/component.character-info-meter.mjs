/**
 * @file A custom element that represents a value with a minimum and a maximum.
 */
import BaseElement from "./component.utils.base-component.mjs"
import { component } from "./component.utils.decorators.mjs"
import html from "../utils/html.mjs"
import styles from "./component.character-info-meter.css" with { type: "css" }

@component("uft-character-info-meter")
export default class CharacterInfoMeter extends BaseElement {
  /**
   * Is this component associated to a form?
   *
   * We use form association to submit values via ElementInternals API.
   */
  static formAssociated = true

  constructor() {
    super()
    this.addEventListener(
      "component:connected",
      this.#removeIconContainerIfUnused,
      { once: true },
    )
  }

  static get observedAttributes() {
    return ["value", "max", "editable"]
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return
    this.shadowRoot.innerHTML = this.template
    this.events()
  }

  events() {
    if (!this.#isEditable) return

    const valueDisplay = this.shadowRoot.querySelector(".value-display")
    const input = this.shadowRoot.querySelector(".value-input")

    if (valueDisplay) {
      valueDisplay.addEventListener("click", () => {
        this.classList.add("editing")
        input?.focus()
        input?.select()
      })
    }

    if (input) {
      input.addEventListener("blur", () => this.#exitEditMode(input))
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          input.blur()
        }
        if (e.key === "Escape") {
          e.preventDefault()
          this.#cancelEdit(input)
        }
      })
    }
  }

  #exitEditMode(input) {
    const newValue = parseInt(input.value, 10)
    if (!isNaN(newValue) && newValue >= 0 && newValue !== this.#value) {
      this.value = newValue.toString()
      this.dispatchEvent(new Event("change", { bubbles: true }))
    }
    this.classList.remove("editing")
  }

  #cancelEdit(input) {
    input.value = this.#value.toString()
    this.classList.remove("editing")
  }

  #removeIconContainerIfUnused() {
    const iconSlot = this.shadowRoot.querySelector('slot[name="icon"]')
    const hasIcon = !!iconSlot?.assignedElements().length
    this.toggleAttribute("has-icon", hasIcon)
  }

  static get styles() {
    return [styles]
  }

  get #isEditable() {
    return this.hasAttribute("editable")
  }

  get #value() {
    const value = parseInt(this.getAttribute("value") || "")
    if (isNaN(value)) return 0
    return value
  }

  get #max() {
    const max = parseInt(this.getAttribute("max") || "")
    if (isNaN(max)) return 100
    return max
  }

  get #progress() {
    const pct = (this.#value / this.#max) * 100 || 0
    if (pct < 0) return 0
    if (pct > 100) return 100
    return pct
  }

  /**
   * Renders the component template.
   * Both display and input are always present; CSS controls visibility.
   */
  get template() {
    const meterClasses = ["meter"]
    if (this.#progress === 0) meterClasses.push("meter--empty")
    if (this.#progress === 100) meterClasses.push("meter--full")

    return html`
      <div class="icon">
        <slot name="icon"></slot>
      </div>
      <div
        class="${meterClasses.join(" ")}"
        style="--meter-fill-pct: ${this.#progress}%"
      >
        <span class="value-display ${this.#isEditable ? "value-display--editable" : ""}"
          >${this.#value}/${this.#max}</span
        >
        ${
          this.#isEditable
            ? html`<input
                type="number"
                name="${this.getAttribute("name") || ""}"
                value="${this.#value}"
                min="0"
                max="${this.#max}"
                class="value-input"
              />`
            : ""
        }
      </div>
    `
  }
}
