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
  /**
   * Build the list of configured sources, resolving each stored `{ id, type }`
   * entry into something we can label in the UI.
   *
   * A source can go missing between sessions -- someone deletes the folder, or
   * disables the module that supplied the compendium. Those entries are kept
   * and flagged as missing rather than dropped, so the GM can see what broke
   * and remove it deliberately.
   * @returns {object} Context for the template
   */
  async _prepareContext() {
    const sourceData = game.settings.get(
      SYSTEM_NAME,
      "characterCreationSources",
    )

    /**
     * Attach a display name to a stored source entry.
     * @param {object} source - A stored `{ id, type }` source entry
     * @returns {object} The entry with `name` and `missing` added
     */
    const enrichSource = (source) => {
      const name =
        source.type === "folder"
          ? game.folders.get(source.id)?.name
          : game.packs.get(source.id)?.metadata?.label

      return {
        ...source,
        name:
          name ??
          game.i18n.localize("BAGS.Settings.CharacterCreation.Sources.Missing"),
        missing: !name,
      }
    }

    // Drive the category list from the registered default rather than from the
    // stored value, so categories added in a later version still show up for
    // worlds whose saved setting predates them.
    const categories = Object.keys(
      game.settings.settings.get(`${SYSTEM_NAME}.characterCreationSources`)
        .default,
    )

    const sources = categories.reduce(
      (obj, category) => ({
        ...obj,
        [category]: (sourceData[category] || []).map(enrichSource),
      }),
      {},
    )

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

  /**
   * The Item types that belong to each source category. Folders are only
   * offered for a category when they actually contain a matching Item, which
   * keeps the dropdowns short in a busy world.
   * @type {Record<string, string[]>}
   */
  static CATEGORY_ITEM_TYPES = {
    classes: ["class"],
    equipment: ["weapon", "armor", "item"],
    identity: ["identity"],
    spells: ["spell"],
    abilities: ["ability"],
  }

  /**
   * Gather every folder and compendium that could serve as a source, grouped
   * by category.
   *
   * Compendiums are offered regardless of contents. Unlike folders, a pack's
   * documents aren't loaded until requested, and loading every Item pack just
   * to populate a dropdown is too slow to justify.
   * @returns {Promise<object>} Available sources, keyed by category
   */
  async #getAvailableSources() {
    const itemPacks = game.packs
      .filter((p) => p.documentName === "Item")
      .map((p) => ({
        id: p.collection,
        name: p.metadata.label,
        type: "compendium",
      }))

    const foldersContaining = (types) =>
      game.folders
        .filter(
          (f) =>
            f.type === "Item" && f.contents.some((i) => types.includes(i.type)),
        )
        .map((f) => ({
          id: f.id,
          name: f.name,
          type: "folder",
        }))

    return Object.entries(this.constructor.CATEGORY_ITEM_TYPES).reduce(
      (obj, [category, types]) => ({
        ...obj,
        [category]: {
          folders: foldersContaining(types),
          compendiums: itemPacks,
        },
      }),
      {},
    )
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options)
    this.element
      .querySelectorAll("select")
      .forEach((select) =>
        select.addEventListener("change", this.#onAddSource.bind(this)),
      )
    this.element.addEventListener("change", this._updateObject)
  }

  /**
   * Add the chosen folder or compendium to a category.
   *
   * The same source is allowed in more than one category (a single "Basics"
   * pack can supply both classes and equipment), but adding it twice to the
   * same category is ignored, since that would duplicate every item in the
   * creation lists.
   * @param {Event} event - The select element's change event
   */
  async #onAddSource(event) {
    const target = event.currentTarget
    const id = target?.value
    if (!id) return

    const categoryElement = target.closest("[data-category]")
    if (!categoryElement) return

    const { category } = categoryElement.dataset
    const { type } = target.querySelector(`[value="${id}"]`)?.dataset ?? {}
    if (!type) return

    const sources = game.settings.get(SYSTEM_NAME, "characterCreationSources")

    // Worlds saved before a category existed won't have a key for it.
    const existing = sources[category] || []
    if (existing.some((s) => s.id === id)) return

    await game.settings.set(SYSTEM_NAME, "characterCreationSources", {
      ...sources,
      [category]: [...existing, { id, type }],
    })

    this.render()
  }

  /**
   * Remove a configured source from a category.
   * @param {Event} event - The click event from the remove button
   */
  static async #onRemoveSource(event) {
    const sourceElement = event.target.closest("[data-source-index]")
    if (!sourceElement) return

    const { category, sourceIndex } = sourceElement.dataset
    const sources = game.settings.get(SYSTEM_NAME, "characterCreationSources")
    const existing = [...(sources[category] || [])]

    existing.splice(Number(sourceIndex), 1)

    await game.settings.set(SYSTEM_NAME, "characterCreationSources", {
      ...sources,
      [category]: existing,
    })

    this.render()
  }
}

export default CharacterCreationSourceConfig
