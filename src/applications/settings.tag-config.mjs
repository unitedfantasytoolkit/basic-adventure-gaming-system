import BAGSApplication from "./application.mjs"
import { SYSTEM_NAME, SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

import TagsDataModel from "../common/tag.datamodel.mjs"

export default class TagManager extends BAGSApplication {
  // === Application Setup =====================================================
  static DEFAULT_OPTIONS = {
    classes: ["application--tag-manager"],
    actions: {
      "add-tag": this.createTag,
      "delete-tag": this.deleteTag,
    },
    /**
     * @todo Set up form handler
     */
    form: {
      handler: null,
    },
    position: {
      width: 600,
      height: 600,
    },
  }

  // --- Tabs ------------------------------------------------------------------

  tabGroups = {
    sheet: "item",
  }

  static TABS = {}

  // --- App parts -------------------------------------------------------------

  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/settings`
  }

  static get PARTS() {
    return {
      tags: {
        template: `${this.TEMPLATE_ROOT}/tag-manager.editor.hbs`,
        scrollable: [".scrollable"],
      },
    }
  }

  title = game.i18n.localize("BAGS.Settings.TagManager.Title")

  // === Context Preparation ================================================
  async _prepareContext(options) {
    const context = await super._prepareContext(options)

    return {
      ...context,
      tags: this.tags,
    }
  }

  async _preparePartContext(partId, context, options) {
    super._preparePartContext(partId, context, options)
    return context
  }

  // === Tag Management ====================================================

  /**
   * @todo Implement!
   */
  static mergeTags(tag) {
    const tags = game.settings.get(SYSTEM_NAME, "tags") || []
    return tags.reduce((arr, t) => {
      return t
    }, [])
  }

  get tags() {
    return game.settings.get(SYSTEM_NAME, "tags") || []
  }

  async setTags(tag) {
    const updatedTags = Array.isArray(tag)
      ? TagManager.margeTags(this.tags, tag)
      : [...this.tags, tag]
    return game.settings.set(SYSTEM_NAME, "tags", updatedTags)
  }

  static async createTag() {
    const tagModel = new TagsDataModel()
    const template = tagModel.schema.fields.tags.element.getInitialValue()
    const updatedTags = [...this.tags, template]

    // tags.push(template)
    await this.setTags(updatedTags)

    this.render(true)
  }

  /**
   * @todo Implement!
   */
  static async deleteTag(event) {
    const { tagId } = event.currentTarget.closest("[data-tag-id]").dataset
    const confirm = await DialogV2.confirm({
      title: game.i18n.localize("BAGS.Settings.TagManager.DeleteConfirm.Title"),
      content: game.i18n.localize(
        "BAGS.Settings.TagManager.DeleteConfirm.Content",
      ),
    })

    if (!confirm) return

    const updatedTags = this.tags.filter((t) => t.id !== tagId)

    await this.setTags(updatedTags)

    this.render(true)
  }
}
