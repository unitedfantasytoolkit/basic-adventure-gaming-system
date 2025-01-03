/**
 * @file A custom element that represents an Ability Score and its modifier
 */
import BaseElement from "../_BaseElement";
import styles from "./AbilityScoreField.css" assert { type: "css" };
import { component } from "../decorators";
import { html } from "../utils";

/**
 * @ignore until we find a way to get Foundry to shift focus
 *         into a component after a sheet updates/rerenders.
 */
@component("uft-ability-score-field")
export default class AbilityScoreField extends BaseElement {
  static get styles() {
    return [styles];
  }

  events() {
    this.shadowRoot
      ?.querySelector(".score-field")
      ?.addEventListener("change", (e) => {
        this.onInput(e);
      });

    if (!this.hasAttribute("readonly") && !this.hasAttribute("disabled"))
      this.shadowRoot
        ?.querySelector("label")
        ?.addEventListener("click", (e) => {
          const evt = new Event("roll");
          evt.metaKey = e.metaKey;
          evt.ctrlKey = e.ctrlKey;
          this.dispatchEvent(evt);
        });
  }

  get template() {
    const modifierInput = html`
      <input
        type="text"
        value="${this.getAttribute("modifier-value")?.toString() || ""}"
        class="field modifier-field"
        readonly
        tabindex="-1"
      />
    `;

    return html` <uft-labeled-section>
      <label
        for="${this.id}"
        slot="heading"
      >
        <slot></slot>
      </label>
      <div
        class="value-pair"
        slot="content"
      >
        <input
          type="text"
          name="${this.getAttribute("name") || ""}"
          id="${this.getAttribute("id") || ""}"
          value="${this.getAttribute("value")?.toString() || ""}"
          class="field score-field"
          ${this.hasAttribute("readonly") ? "readonly" : ""}
          ${this.hasAttribute("disabled") ? "disabled" : ""}
        />
        ${this.getAttribute("modifier-value") ? modifierInput : ""}
      </div>
    </uft-labeled-section>`;
  }

  onInput(e) {
    const oldValue = parseInt(this.getAttribute("value") || "", 10);
    let newValue = parseInt(e.target.value || "", 10);

    if (newValue < 0) newValue = 0;
    if (Number.isNaN(newValue)) newValue = oldValue;

    super.value = newValue.toString();
  }
}
