/**
 * @file An Application that manages data sources used for character creation.
 */

import { SYSTEM_NAME, SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api

/**
 * An Application for managing the data sources used for character creation.
 * @class
 * TODO: Use a tabbed UI to separate the different types of data
 * TODO: Use a filter and a scrollable pane instead of a `<select />` element
 */
class CharacterCreationSourceConfig extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  // === Application Setup =====================================================
  static DEFAULT_OPTIONS = {
    id: "character-creation-source-config",
    classes: [
      "application--character-creation-sources",
      "application--bags",
      "application--hide-title",
    ],
    tag: "form",
    window: {
      frame: true,
      positioned: true,
      controls: [],
      minimizable: false,
      resizable: false,
      contentTag: "section",
      contentClasses: [],
    },
    actions: {
      "remove-source": this.#onRemoveSource,
    },
    form: {
      handler: this.save,
      submitOnChange: false,
    },
    position: {
      width: 600,
      height: "auto",
    },
  }

  // === Rendering ==========================================================
  static get TEMPLATE_ROOT() {
    return `${SYSTEM_TEMPLATE_PATH}/settings`
  }

  static PARTS = {
    header: {
      template: `${SYSTEM_TEMPLATE_PATH}/common/header.hbs`,
    },
    sources: {
      template: `${this.TEMPLATE_ROOT}/character-creation-sources.hbs`,
      scrollable: [".scrollable"],
    },
  }

  get title() {
    return game.i18n.localize("BAGS.Settings.CharacterCreation.Sources.Title")
  }

  // === Context Preparation ================================================
  async _prepareContext() {
    const sourceData = game.settings.get(
      SYSTEM_NAME,
      "characterCreationSources",
    )

    const enrichSource = (s) => {
      const sourceObj = { ...s }
      if (s.type === "folder") sourceObj.name = game.folders.get(s.id).name
      if (s.type === "compendium")
        sourceObj.name = game.packs.get(s.id).metadata.label
      return sourceObj
    }

    const sources = {}

    Object.keys(sourceData).forEach(async (key) => {
      await Promise.all(sourceData[key].map(enrichSource))
    })

    return {
      sources,
      availableSources: await this.#getAvailableSources(),
    }
  }

  async _preparePartContext(partId, context) {
    switch (partId) {
      case "header":
        context.title = this.title
        break
      default:
        break
    }
    return context
  }

  // === Source Management =================================================
  async #getAvailableSources() {
    const sources = {
      classes: {
        folders: game.folders
          .filter(
            (f) =>
              f.type === "Item" && f.contents.some((i) => i.type === "class"),
          )
          .map((f) => ({
            id: f.id,
            name: f.name,
            type: "folder",
          })),
        compendiums: game.packs
          .filter((p) => p.documentName === "Item")
          .map((p) => ({
            id: p.collection,
            name: p.metadata.label,
            type: "compendium",
          })),
      },
      equipment: {
        folders: game.folders
          .filter(
            (f) =>
              f.type === "Item" &&
              f.contents.some((i) =>
                ["weapon", "armor", "gear"].includes(i.type),
              ),
          )
          .map((f) => ({
            id: f.id,
            name: f.name,
            type: "folder",
          })),
        compendiums: game.packs
          .filter((p) => p.documentName === "Item")
          .map((p) => ({
            id: p.collection,
            name: p.metadata.label,
            type: "compendium",
          })),
      },
    }
    return sources
  }

  _onRender(context, options) {
    super._onRender(context, options)
    for (const select of this.element.querySelectorAll("select")) {
      select.addEventListener("change", this.#onAddSource.bind(this))
    }
    this.element.addEventListener("change", this._updateObject)
  }

  async #onAddSource(event) {
    const target = event.currentTarget
    const id = target?.value
    if (!id) return
    if (!target.closest("[data-category]")) return

    try {
      const { category } = target.closest("[data-category]").dataset
      const { type } = target.querySelector(`[value="${id}"]`).dataset
      if (!type) return

      const sources = game.settings.get(SYSTEM_NAME, "characterCreationSources")
      sources[category].push({
        id,
        type,
      })

      await game.settings.set(SYSTEM_NAME, "characterCreationSources", sources)
    } catch {
      /* noop */
    }

    this.render()
  }

  static async #onRemoveSource(event) {
    const { category, index } = event.target.closest(
      "[data-source-index]",
    ).dataset

    const sources = game.settings.get(SYSTEM_NAME, "characterCreationSources")
    sources[category].splice(index, 1)

    await game.settings.set(SYSTEM_NAME, "characterCreationSources", sources)
    this.render()
  }
}

export default CharacterCreationSourceConfig
