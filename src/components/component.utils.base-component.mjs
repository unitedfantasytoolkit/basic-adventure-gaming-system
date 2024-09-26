/**
 * @file The base class for custom elements.
 */
import html from "../utils/html.mjs"

/**
 * The base component class
 */
export default class BaseComponent extends HTMLElement {
  /**
   * This component's constructed stylesheets.
   *
   * @returns An array of `CSSStyleSheet`s to be attached to the Shadow DOM
   */
  static get styles() {
    return []
  }

  /**
   * The HTML template to render for the component.
   */
  get template() {
    return html``
  }

  /**
   * Prepare any data ahead of rendering the component.
   *
   * Typically, this will be things like fetching a Document with its UUID.
   */
  async prepareData() {}

  /**
   * Bind any events here after the component is rendered here.
   */
  events() {}

  /**
   * Is this component associated to a form?
   *
   * A must when trying to use a component to update a Foundry document!
   */
  static formAssociated = true

  // ---------------------------------------------------------------------
  // INFRASTRUCTURE STUFF BELOW -- PROBABLY DON'T CHANGE IT IN A COMPONENT

  constructor() {
    super()
    this.shadowRoot = this.attachShadow({
      mode: "open",
      delegatesFocus: true,
    })
    this.internals = this.attachInternals()
  }

  /**
   * The root of this component's shadow DOM.
   */
  shadowRoot

  /**
   * The element's internals, containing useful tools for interacting with forms and validation
   */
  internals

  /**
   * Fires when the component is mounted to the DOM, and whenever it sees changes.
   */
  async connectedCallback() {
    await this.prepareData()
    this.value = this.getAttribute("value")?.toString() || ""
    this.shadowRoot.adoptedStyleSheets = this.constructor.styles
    this.shadowRoot.innerHTML = this.template
    this.events()
    this.dispatchEvent(
      new CustomEvent("component:connected", { bubbles: false })
    )
  }

  async disconnectedCallback() {
    this.dispatchEvent(
      new CustomEvent("component:disconnected", { bubbles: false })
    )
  }

  /**
   * The component's value, from its attributes.
   */
  get value() {
    return this.getAttribute("value") || ""
  }

  /**
   * Set the component's value on its internals and in its attributes,
   * then tell the containing Sheet that we're ready to update.
   *
   * @param newValue - The new value that we'll use to update the component's value.
   */
  set value(newValue) {
    // @ts-expect-error - this.constructor is of type Function,
    //                     but refers to the inheritor's class,
    //                     which has static members like formAssociated
    if (!this.constructor.formAssociated) return

    this.setAttribute("value", newValue)
    this.internals?.setFormValue(newValue)
    this.dispatchEvent(new Event("change", { bubbles: true }))
  }

  get name() {
    return this.getAttribute("name") || ""
  }

  static localize(s) {
    // @ts-expect-error - game.i18n exists
    return game.i18n.localize(s)
  }

  static format(s) {
    // @ts-expect-error - game.i18n exists
    return game.i18n.format(s, options)
  }
}
