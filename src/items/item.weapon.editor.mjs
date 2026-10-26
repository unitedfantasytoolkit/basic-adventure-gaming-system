import BAGSBaseItemEditor from "./item.editor.mjs"
import { resolveInitiativeConfig } from "../combat/initiative-config.mjs"

export default class BAGSWeaponEditor extends BAGSBaseItemEditor {
  // === App config ============================================================

  static get DEFAULT_OPTIONS() {
    return {
      classes: ["application--weapon-editor"],
    }
  }

  static DOCUMENT_TYPE = "weapon"

  // --- Tabs ------------------------------------------------------------------

  static TABS = {
    sheet: {
      tabs: [
        {
          id: "details",
          group: "sheet",
          icon: "fa-solid fa-square-list",
          label: "BAGS.Items.Weapon.Tabs.Details",
          cssClass: "tab--summary",
        },
        {
          id: "attack",
          group: "sheet",
          icon: "fa-solid fa-swords",
          label: "BAGS.Items.Weapon.Tabs.Attack",
          cssClass: "tab--attack",
        },
        ...super.TABS.sheet.tabs,
      ],
      initial: "details",
      labelPrefix: "BAGS.Actors.Character.Tabs",
    },
  }

  static TAB_PARTS = {
    details: {
      template: `${this.TEMPLATE_ROOT}/details.hbs`,
    },
    attack: {
      template: `${this.TEMPLATE_ROOT}/attack.hbs`,
    },
  }

  /**
   * Add which initiative properties the world's rules actually read.
   *
   * A weapon carries fields for every game BAGS models, but no single table
   * plays all of them: a slow weapon means something in B/X and nothing in AD&D,
   * and a speed factor is the reverse. Showing all of them everywhere asks a
   * referee to fill in numbers their rules will never look at, and invites the
   * reasonable assumption that filling them in *does* something.
   *
   * Resolved without a combat, so this is the world's selected ruleset. A
   * per-encounter override is a property of that encounter, not of a weapon
   * sitting in someone's pack.
   * @inheritDoc
   */
  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    const initiative = resolveInitiativeConfig()

    return {
      ...context,
      initiativeFields: {
        isSlow: initiative.usesSlowWeapons,
        speedFactor: initiative.usesWeaponSpeed,
        rateOfFire: initiative.usesRateOfFire,
        any:
          initiative.usesSlowWeapons ||
          initiative.usesWeaponSpeed ||
          initiative.usesRateOfFire,
      },
    }
  }
}
