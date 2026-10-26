/**
 * @file The Rewards sidebar tab -- experience the party has earned but not yet
 * been awarded.
 *
 * This is the referee's side of the table: a running list of what the party has
 * coming to them, so the awards can be worked out once and handed over together
 * rather than remembered one at a time.
 *
 * Laid out like the Party tab beside it: controls and status in the header, the
 * list in the middle, and the action that finishes the job in the footer.
 */

import { SYSTEM_TEMPLATE_PATH } from "../config/constants.mjs"
import { awardLedger, previewAwards } from "./award.mjs"
import {
  addEntry,
  clearLedger,
  getEntries,
  getTotalXP,
  removeEntry,
  REWARD_KINDS,
  updateEntry,
} from "./ledger.mjs"
import { showRewardEditor } from "./reward-editor.mjs"

const { HandlebarsApplicationMixin } = foundry.applications.api
const { AbstractSidebarTab } = foundry.applications.sidebar

/**
 * The icon shown beside each kind of reward.
 * @type {Record<string, string>}
 */
const KIND_ICONS = {
  [REWARD_KINDS.TREASURE]: "fa-coins",
  [REWARD_KINDS.MONSTERS]: "fa-dragon",
  [REWARD_KINDS.GEAR]: "fa-wand-sparkles",
  [REWARD_KINDS.MANUAL]: "fa-star",
}

/**
 * Describe who an entry goes to, in a phrase short enough for a sidebar row.
 * @param {import("./ledger.mjs").RewardEntry} entry - The reward
 * @returns {string} The description
 */
const describeRecipients = (entry) => {
  if (entry.recipients === "all")
    return game.i18n.localize("BAGS.Rewards.Recipients.WholeParty")

  const count = Array.isArray(entry.recipients) ? entry.recipients.length : 0

  return count === 1
    ? game.i18n.localize("BAGS.Rewards.Recipients.One")
    : game.i18n.format("BAGS.Rewards.Recipients.Some", { count })
}

/**
 * Show the editor for an existing entry and save whatever comes back.
 * @param {import("./ledger.mjs").RewardEntry} [entry] - The reward to edit
 * @returns {Promise<void>} Resolves once the change has been saved
 */
const editEntry = async (entry) => {
  if (!entry) return

  const changes = await showRewardEditor(entry)
  if (changes) await updateEntry(entry.id, changes)
}

/**
 * The right-click menu for a ledger entry.
 *
 * Rebuilt each time the menu opens, so it reads the current ledger.
 * @returns {object[]} The context menu entries
 */
const getEntryContextOptions = () => {
  /**
   * Find the entry a menu entry was opened against.
   * @param {HTMLElement} element - The clicked row
   * @returns {import("./ledger.mjs").RewardEntry|undefined} The reward
   */
  const getEntry = (element) =>
    getEntries().find((entry) => entry.id === element.dataset.entryId)

  return [
    {
      name: "BAGS.Rewards.Editor.Edit",
      icon: '<i class="fa-solid fa-pen-to-square"></i>',
      callback: (element) => editEntry(getEntry(element)),
    },
    {
      name: "BAGS.Rewards.Remove",
      icon: '<i class="fa-solid fa-trash"></i>',
      callback: (element) => removeEntry(element.dataset.entryId),
    },
  ]
}

/**
 * The Rewards sidebar tab.
 */
export default class RewardsSidebar extends HandlebarsApplicationMixin(
  AbstractSidebarTab,
) {
  /** @override */
  static tabName = "rewards"

  /**
   * The tooltip for the sidebar tab's button. Read by `BAGSSidebar`.
   * @type {string}
   */
  static tooltip = "BAGS.Rewards.Title"

  /**
   * The icon for the sidebar tab's button. Read by `BAGSSidebar`.
   * @type {string}
   */
  static icon = "fa-solid fa-trophy"

  /**
   * As with the Party tab, the `rewards-sidebar` class comes from `tabName` by way
   * of `AbstractSidebarTab`, so it isn't declared here.
   * @override
   */
  static DEFAULT_OPTIONS = {
    window: {
      title: "BAGS.Rewards.Title",
    },
    actions: {
      addReward: RewardsSidebar.#onAddReward,
      awardAll: RewardsSidebar.#onAwardAll,
      clearLedger: RewardsSidebar.#onClearLedger,
      editReward: RewardsSidebar.#onEditReward,
      removeReward: RewardsSidebar.#onRemoveReward,
    },
  }

  /** @override */
  static PARTS = {
    header: {
      template: `${SYSTEM_TEMPLATE_PATH}/sidebar/rewards-header.hbs`,
    },
    ledger: {
      template: `${SYSTEM_TEMPLATE_PATH}/sidebar/rewards.hbs`,
      scrollable: [""],
    },
    footer: {
      template: `${SYSTEM_TEMPLATE_PATH}/sidebar/rewards-footer.hbs`,
    },
  }

  /**
   * Keep the tab out of a player's sidebar.
   *
   * The tab button is already hidden for them by the `gmOnly` flag in the
   * sidebar's tab configuration. Declining to render as well means the content
   * is never built, rather than built and hidden.
   * @override
   * @param {object} options - Options which configure rendering behavior
   * @returns {boolean|void} False to decline the render
   */
  _canRender(options) {
    if (!game.user.isGM) return false
    return super._canRender(options)
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options)
    const entries = getEntries()
    const totalXP = getTotalXP(entries)

    // Not the same as the ledger's total: an unsplit reward multiplies across its
    // recipients, and one aimed at nobody still in the party is worth nothing.
    const { awards, unclassed } = entries.length
      ? previewAwards()
      : { awards: [], unclassed: [] }

    return {
      ...context,
      entries: entries.map((entry) => ({
        ...entry,
        icon: KIND_ICONS[entry.kind] ?? KIND_ICONS[REWARD_KINDS.MANUAL],
        recipientLabel: describeRecipients(entry),
      })),
      hasEntries: !!entries.length,
      totalXP,
      canAward: !!awards.length,
      hasUnclassed: !!unclassed.length,
      // Joined here because Handlebars has no helper for it.
      unclassed: unclassed.map((actor) => actor.name).join(", "),
      title: entries.length
        ? game.i18n.format("BAGS.Rewards.PendingTotal", { xp: totalXP })
        : game.i18n.localize("BAGS.Rewards.Title"),
    }
  }

  /** @inheritDoc */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options)

    this._createContextMenu(getEntryContextOptions, ".reward-entry", {
      fixed: true,
    })
  }

  // === Event handlers ========================================================

  /**
   * Record a new reward.
   * @this {RewardsSidebar}
   * @returns {Promise<void>} Resolves once the reward has been recorded
   */
  static async #onAddReward() {
    const entry = await showRewardEditor()
    if (entry) await addEntry(entry)
  }

  /**
   * Edit the reward a row belongs to.
   * @this {RewardsSidebar}
   * @param {PointerEvent} _event - The originating click
   * @param {HTMLElement} target - The element carrying the action
   * @returns {Promise<void>} Resolves once the change has been saved
   */
  static async #onEditReward(_event, target) {
    const { entryId } = target.closest("[data-entry-id]")?.dataset ?? {}
    await editEntry(getEntries().find((entry) => entry.id === entryId))
  }

  /**
   * Drop a reward from the ledger.
   * @this {RewardsSidebar}
   * @param {PointerEvent} _event - The originating click
   * @param {HTMLElement} target - The element carrying the action
   * @returns {Promise<void>} Resolves once the reward is gone
   */
  static async #onRemoveReward(_event, target) {
    const { entryId } = target.closest("[data-entry-id]")?.dataset ?? {}
    if (entryId) await removeEntry(entryId)
  }

  /**
   * Hand the whole ledger over to the party.
   * @this {RewardsSidebar}
   * @returns {Promise<void>} Resolves once the rewards have been handed out
   */
  static async #onAwardAll() {
    await awardLedger()
  }

  /**
   * Throw the ledger away without awarding it.
   * @this {RewardsSidebar}
   * @returns {Promise<void>} Resolves once the ledger is empty
   */
  static async #onClearLedger() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize("BAGS.Rewards.Clear.Title") },
      content: `<p>${game.i18n.localize("BAGS.Rewards.Clear.Prompt")}</p>`,
      rejectClose: false,
    })

    if (confirmed) await clearLedger()
  }
}
