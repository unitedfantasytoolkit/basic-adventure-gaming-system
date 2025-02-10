import BAGSApplication from "../common/app.mjs"

/**
 * @todo Should we have a BAGSBaseItemEditor class?
 */
export default class BAGSWeaponEditor extends BAGSApplication {
  static TAB_PARTS = {}

  // === App config ============================================================

  get title() {
    return `Editor: ${this.document.name}`
    // return game.i18n.format("BAGS", { name: this.document.name })
  }

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["application--editor", "application--weapon-editor"],
      window: {
        resizable: false,
      },
      position: {
        width: 320,
        height: 600,
      },
    }
  }
}
