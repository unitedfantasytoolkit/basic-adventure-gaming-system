/**
 * @file Replace Foundry's tabbed sidebar with one that has room for the tabs
 * this system adds.
 */

import PartySidebar from "../party/sidebar.mjs"
import RewardsSidebar from "../rewards/sidebar.mjs"

/**
 * A description of one sidebar tab the system adds.
 * @typedef {object} SystemTab
 * @property {string} id - The tab's key. Must match the tab application's
 * `tabName` and the key it is registered under in `CONFIG.ui`.
 * @property {string} after - The id of the tab this one should follow.
 * @property {object} descriptor - The tab configuration Foundry reads: a
 * `tooltip`, an `icon`, and optionally `gmOnly`.
 */

/**
 * The tabs BAGS adds to the sidebar, in the order they should be inserted.
 *
 * Foundry builds the tab strip by walking `Sidebar.TABS` in insertion order, so
 * placing a tab means rebuilding that record with ours slotted into the right
 * spot -- there's no sort index to set. Each entry names the tab it follows so
 * the intent survives Foundry adding or reordering its own tabs.
 * @type {SystemTab[]}
 */
const SYSTEM_TABS = [
  {
    id: "party",
    after: "combat",
    descriptor: {
      tooltip: PartySidebar.tooltip,
      icon: PartySidebar.icon,
    },
  },
  {
    id: "rewards",
    after: "party",
    descriptor: {
      tooltip: RewardsSidebar.tooltip,
      icon: RewardsSidebar.icon,
      // The rewards ledger is the referee's scratch pad, so players have no
      // reason to see the tab at all.
      gmOnly: true,
    },
  },
]

/**
 * Build a tab configuration with the system's tabs slotted into Foundry's.
 *
 * Tabs are inserted one at a time and in order, so a tab may anchor itself to
 * another system tab as well as to one of Foundry's.
 * @param {Record<string, object>} coreTabs - Foundry's own tab configuration
 * @returns {Record<string, object>} The combined configuration, in display order
 */
const withSystemTabs = (coreTabs) =>
  SYSTEM_TABS.reduce((tabs, { id, after, descriptor }) => {
    const entries = Object.entries(tabs)
    const anchor = entries.findIndex(([key]) => key === after)

    // An anchor we don't recognize means Foundry renamed or dropped that tab.
    // Falling back to the end of the strip keeps our tab reachable instead of
    // dropping it on the floor.
    const insertAt = anchor === -1 ? entries.length : anchor + 1

    return Object.fromEntries([
      ...entries.slice(0, insertAt),
      [id, descriptor],
      ...entries.slice(insertAt),
    ])
  }, coreTabs)

/**
 * Foundry's sidebar, plus the system's own tabs.
 *
 * Install it by assigning this class to `CONFIG.ui.sidebar`, and register each
 * tab application under `CONFIG.ui[tabId]`. See `hooks/setup.ui.mjs`.
 */
export default class BAGSSidebar extends foundry.applications.sidebar.Sidebar {
  /**
   * Foundry's tab configuration with the system's tabs added.
   *
   * This has to be a static. Foundry reads `this.constructor.TABS` when it
   * decides which render parts to build, when it renders the tabs for the first
   * time, and when it prepares the tab strip's context -- an instance field of
   * the same name is read by none of them, and produces a tab button with no
   * content behind it.
   * @type {Record<string, object>}
   */
  static TABS = withSystemTabs(super.TABS)

  /**
   * Our own copy of the parent's render parts.
   *
   * Foundry adds one part per tab by assigning into `this.constructor.PARTS` as
   * it configures a render. Without a copy of our own, that writes the system's
   * tabs into Foundry's static and leaves them there for any other sidebar
   * class that renders later.
   * @type {Record<string, object>}
   */
  static PARTS = { ...super.PARTS }
}
