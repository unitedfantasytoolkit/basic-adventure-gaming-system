/**
 * @file The dialog a player uses to say what they are about to do.
 *
 * Deliberately small, and deliberately not a modal that opens by itself. An
 * unrequested window at the top of every round is exactly the tedium that
 * optional declarations exist to avoid; the tracker shows what has been declared
 * inline, and this opens only when someone asks for it.
 *
 * Players can write their own `Combatant.system` directly -- Foundry's Combatant
 * permissions allow `initiative`, `flags`, `defeated` and `system` for an owner
 * -- so declaring needs no socket and no GM relay.
 */

import { SYSTEM_TEMPLATE_PATH } from "../../config/constants.mjs"
import {
  blankDeclaration,
  getDeclarationFields,
  getDeclarationTypes,
} from "../declarations.mjs"

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api

/**
 * Build the update that records a declaration.
 *
 * **Nested, never dot-notation.** Foundry decides whether a non-GM may write to a
 * Combatant by testing `Object.keys(data)` against an allowlist of top-level
 * fields -- `["_id", "initiative", "flags", "defeated", "system"]`. A key of
 * `"system.declaration.type"` is not `"system"`, so the whole update is refused,
 * and refused silently: the player clicks, nothing happens, and nothing explains
 * why. A GM never sees it, because GMs bypass the check entirely.
 * @param {string} typeId - A declaration type id, or "" to withdraw.
 * @param {Record<string, number>} [values] - Numbers the chosen type asked for.
 * @returns {object} An update a player is allowed to make.
 */
const declarationUpdate = (typeId, values = {}) => {
  // Every field is named, starting from a blank, because an update *merges* into
  // a SchemaField. Sending only the fields the chosen action asked for would
  // leave the ones belonging to a previous choice untouched -- declare a spell
  // with a casting time of 6, change to melee, and the 6 is still sitting there
  // for whatever reads it next.
  const declaration = blankDeclaration()
  return {
    system: {
      declaration: {
        ...declaration,
        type: typeId,
        values: { ...declaration.values, ...values },
      },
    },
  }
}

/**
 * A dialog for declaring a combatant's action.
 */
export default class BAGSDeclarationDialog extends HandlebarsApplicationMixin(
  ApplicationV2,
) {
  /**
   * @param {object} options - Application options.
   * @param {Combatant} options.combatant - Who is declaring.
   */
  constructor({ combatant, ...options } = {}) {
    super(options)
    this.#combatant = combatant
  }

  /**
   * The combatant this dialog speaks for.
   * @type {Combatant}
   */
  #combatant

  /** @inheritdoc */
  static DEFAULT_OPTIONS = {
    id: "bags-declaration-{id}",
    classes: ["bags", "bags-declaration"],
    tag: "div",
    window: {
      title: "BAGS.Combat.Declarations.Title",
      icon: "fa-solid fa-comment",
    },
    position: { width: 360, height: "auto" },
    actions: {
      declare: BAGSDeclarationDialog.#onDeclare,
      clearDeclaration: BAGSDeclarationDialog.#onClear,
    },
  }

  /** @inheritdoc */
  static PARTS = {
    main: { template: `${SYSTEM_TEMPLATE_PATH}/combat/declaration.hbs` },
  }

  /** @inheritdoc */
  get title() {
    return game.i18n.format("BAGS.Combat.Declarations.TitleFor", {
      name: this.#combatant.name,
    })
  }

  /** @inheritdoc */
  async _prepareContext() {
    const combat = this.#combatant.parent
    const ruleset = combat?.initiativeConfig?.rules?.ruleset
    const declaration = this.#combatant.system?.declaration
    const current = declaration?.type ?? ""

    return {
      combatant: this.#combatant,
      // Only what this game actually offers. A B/X table should not be shown
      // 1st Edition's "set weapon against charge".
      types: getDeclarationTypes(ruleset).map((type) => {
        const isCurrent = type.id === current
        const fields = getDeclarationFields(type.id, ruleset).map((field) => ({
          ...field,
          // Resolved here rather than compared in the template, which would mean
          // depending on a comparison helper this system does not register.
          isRange: field.widget === "range",
          // A stored number belongs to the action that asked for it. Only the
          // currently declared option opens on what was saved; every other
          // option opens on its own default.
          value:
            isCurrent && Number.isFinite(declaration?.values?.[field.name])
              ? declaration.values[field.name]
              : field.initial,
        }))

        return {
          ...type,
          label: game.i18n.localize(type.label),
          selected: isCurrent,
          // Undefined rather than an empty array, so the template's
          // `{{#if fields}}` skips the wrapper entirely.
          fields: fields.length ? fields : undefined,
        }
      }),
      hasDeclaration: !!current,
      // The group's declaration is shown when this combatant has none of its
      // own, so a player can see what the mob is doing and that their own
      // choice would override it.
      inherited:
        !current && this.#combatant.rollingGroup?.system?.declaration?.type
          ? this.#combatant.rollingGroup.name
          : null,
    }
  }

  /**
   * Show the chosen action's fields and hide everything else's.
   *
   * The fields all stay in the DOM; only their visibility changes. Rendering
   * them on demand would discard a half-entered casting time the moment someone
   * clicked another option to read its label.
   * @inheritdoc
   */
  _onRender(context, options) {
    super._onRender(context, options)

    const wrap = this.element
    wrap.querySelectorAll("input[name='type']").forEach((radio) => {
      radio.addEventListener("change", () => {
        wrap.querySelectorAll("[data-fields-for]").forEach((group) => {
          group.toggleAttribute(
            "hidden",
            group.dataset.fieldsFor !== radio.value,
          )
        })
        wrap
          .querySelectorAll(".bags-declaration__type")
          .forEach((row) =>
            row.classList.toggle(
              "bags-declaration__type--selected",
              row.contains(radio) && radio.checked,
            ),
          )

        // The first field of a freshly revealed action is almost always the
        // next thing wanted, and finding it by hand costs a click at a moment
        // when the rest of the table is waiting.
        wrap.querySelector(`[data-fields-for="${radio.value}"] input`)?.focus()
      })
    })
  }

  /**
   * Read the chosen action and whatever numbers it asked for.
   * @returns {{typeId: string, values: Record<string, number>}} The selection.
   */
  #readForm() {
    const wrap = this.element
    const typeId = wrap.querySelector("input[name='type']:checked")?.value ?? ""
    const values = {}

    // Selected on `[name]` rather than on `input`, because a range field is
    // Foundry's `<range-picker>` custom element and not an input at all. Both
    // expose a `value`, so reading it by name works for either -- and `input`
    // alone would silently drop every distance anyone dragged.
    //
    // Only the chosen action's fields are read. The others are still in the DOM
    // holding whatever was entered before the selection changed, and none of it
    // belongs to the declaration being made.
    wrap
      .querySelectorAll(`[data-fields-for="${typeId}"] [name^="values."]`)
      .forEach((field) => {
        const value = Number(field.value)
        if (Number.isFinite(value)) {
          values[field.getAttribute("name").slice("values.".length)] = value
        }
      })

    return { typeId, values }
  }

  /**
   * Record a declaration.
   * @this {BAGSDeclarationDialog}
   * @returns {Promise<void>} Resolves once the write lands.
   */
  static async #onDeclare() {
    const { typeId, values } = this.#readForm()
    if (!typeId) return

    await this.#combatant.update(declarationUpdate(typeId, values))

    /**
     * Observation only. The write has already happened, and a player writing
     * their own `system` data is not something a client-side hook could veto
     * even if it wanted to.
     * @fires BAGS.declareAction
     */
    Hooks.callAll("BAGS.declareAction", this.#combatant, typeId)

    await this.close()
  }

  /**
   * Withdraw a declaration, returning the combatant to undeclared.
   * @this {BAGSDeclarationDialog}
   * @returns {Promise<void>} Resolves once the write lands.
   */
  static async #onClear() {
    await this.#combatant.update(declarationUpdate(""))
    Hooks.callAll("BAGS.declareAction", this.#combatant, "")
    await this.close()
  }
}
