/**
 * @file A subapp for {@link ./action-editor.mjs} that allows a user to edit an
 * action's effect.
 */
import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

import BAGSApplication from "../applications/application.mjs"

/**
 * @type {object} ActionEffectEditor
 * @class
 */
export default class BAGSActiveEffectEditor extends BAGSApplication {
  static DEFAULT_OPTIONS = {
    classes: ["application--active-effect-editor"],
    position: {
      width: 520,
      height: 480,
    },
    actions: {
      "add-active-effect": this.addActiveEffect,
      "edit-active-effect": this.editActiveEffect,
      "toggle-active-effect": this.toggleActiveEffect,
      "delete-active-effect": this.deleteActiveEffect,
    },
    form: {
      handler: null,
    },
  }

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/active-effects`
  }

  static PARTS = {
    effect: {
      template: `${this.TEMPLATE_ROOT}/editor.hbs`,
      scrollable: [".scrollable"],
    },
  }

  get title() {
    return `Active Effects: ${this.document.name}`
  }

  // === Events ================================================================

  static async addActiveEffect() {
    await this.document.createEmbeddedDocuments("ActiveEffect", [
      this.document.effects.createDocument({
        name: game.i18n.localize("BAGS.ActiveEffects.DefaultName"),
        img: "icons/svg/aura.svg",
      }),
    ])
    this.render(true)
  }

  static async editActiveEffect(e) {
    const { effectId } = e.target.closest("[data-effect-id]").dataset
    this.document.effects.get(effectId).sheet.render(true)
  }

  static async toggleActiveEffect(e) {
    const { effectId } = e.target.closest("[data-effect-id]").dataset
    const effect = this.document.effects.get(effectId)
    effect.update({ disabled: !effect.disabled })
    this.render(true)
  }

  static async deleteActiveEffect(e) {
    const { effectId } = e.target.closest("[data-effect-id]").dataset
    await this.document.effects.get(effectId).deleteDialog()
    this.render(true)
  }
}
