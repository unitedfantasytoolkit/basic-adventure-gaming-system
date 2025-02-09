/**
 * @file The base class for applications in this system.
 */
const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api

export default class BAGSApplication extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  static SUB_APPS = []

  get subApps() {
    return this.#subApps
  }

  static get HEADER_CONTROLS() {
    return []
  }

  #subApps = {}

  constructor(options = {}) {
    super(options)

    this.document = options?.document

    this.#subApps = this.constructor.SUB_APPS.reduce(
      (obj, App) => ({
        ...obj,
        [App.constructor.name]: new App(this.document),
      }),
      {},
    )
  }

  static TABS = []

  static DEFAULT_OPTIONS = {
    classes: ["application--bags", "application--sheet"],
    tag: "form",
    window: {
      controls: this.HEADER_CONTROLS,
      minimizable: true,
      resizable: true,
      contentTag: "section",
    },
    form: {
      handler: this.save,
      submitOnChange: true,
    },
  }

  static async save(_event, _form, formData) {
    await this.document.update(formData.object)
  }

  static PARTS = {}

  /** @override */
  async _prepareContext(_options) {
    const doc = this.document

    return {
      document: doc,
      source: doc.toObject(),
      fields: doc.schema.fields,
      systemFields: doc.system.schema.fields,
      formattedSystem: this.#prepareFormattedFields(),
    }
  }

  #prepareFormattedFields() {
    return null
  }

  close() {
    Object.values(this.subApps).forEach((a) => a.close())
    return super.close()
  }

  /**
   * Render the outer framing HTMLElement which wraps the inner HTML of
   * the Application.
   *
   * This override modifies the default frame by adding the following:
   * - an alternative header: the existing elements in the header are moved
   *   around into a format tha makes more sense for our design.
   * - tab navigation: if the sheet has tabs, to enforce consistency.
   * - an effects pane: a common UI for managing active effects on
   *   actors and items
   * @param {unknown} options - Options which configure application rendering
   * behavior. See {RenderOptions} in Foundry's types.
   * @returns {Promise<HTMLElement>} The updated app frame
   * @protected
   * @override
   */
  async _renderFrame(options) {
    const frame = await super._renderFrame(options)
    this.#reorganizeHeaderElements(frame)
    return frame
  }

  /**
   * Given the window's frame, mutate its header to make it easier to style.
   * @param {HTMLElement} frame - The window frame
   */
  async #reorganizeHeaderElements(frame) {
    const header = frame.querySelector(".window-header")
    const title = frame.querySelector(".window-title")

    const buttons = header.querySelectorAll("button")

    const buttonContainer = document.createElement("div")
    buttonContainer.classList.add("window-buttons")

    const titleAreaContainer = document.createElement("div")
    titleAreaContainer.classList.add("window-header__content")

    buttons.forEach((b) => buttonContainer.appendChild(b))

    titleAreaContainer.appendChild(title)

    header.appendChild(buttonContainer)

    if (this.document.system.banner) {
      const banner = document.createElement("img")
      banner.src = this.document.system.banner
      header.appendChild(banner)
    }

    header.appendChild(titleAreaContainer)
  }
}
