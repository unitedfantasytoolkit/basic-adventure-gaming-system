/**
 * @file Overwrite the default Foundry tabbed sidebar with some additions of our own.
 */

import PartySidebar from "../party/sidebar.mjs"

export default class BAGSSidebar extends foundry.applications.sidebar.Sidebar {
  /**
   * Expanded tab configuration to account for new sidebar tabs.
   * @type {Record<string, SidebarTabDescriptor>}
   */
  TABS = {
    chat: {
      tooltip: ChatMessage.metadata.labelPlural,
      icon: CONFIG.ChatMessage.sidebarIcon,
    },
    combat: {
      tooltip: Combat.metadata.labelPlural,
      icon: CONFIG.Combat.sidebarIcon,
    },
    scenes: {
      tooltip: Scene.metadata.labelPlural,
      icon: CONFIG.Scene.sidebarIcon,
    },
    party: {
      tooltip: PartySidebar.tooltip,
      icon: PartySidebar.icon,
    },
    actors: {
      tooltip: Actor.metadata.labelPlural,
      icon: CONFIG.Actor.sidebarIcon,
    },
    items: {
      tooltip: Item.metadata.labelPlural,
      icon: CONFIG.Item.sidebarIcon,
    },
    journal: {
      tooltip: "SIDEBAR.TabJournal",
      icon: CONFIG.JournalEntry.sidebarIcon,
    },
    tables: {
      tooltip: RollTable.metadata.labelPlural,
      icon: CONFIG.RollTable.sidebarIcon,
    },
    cards: {
      tooltip: Cards.metadata.labelPlural,
      icon: CONFIG.Cards.sidebarIcon,
    },
    macros: {
      tooltip: Macro.metadata.labelPlural,
      icon: CONFIG.Macro.sidebarIcon,
    },
    playlists: {
      tooltip: Playlist.metadata.labelPlural,
      icon: CONFIG.Playlist.sidebarIcon,
    },
    compendium: {
      tooltip: "SIDEBAR.TabCompendium",
      icon: "fas fa-atlas",
    },
    settings: {
      tooltip: "SIDEBAR.TabSettings",
      icon: "fas fa-cogs",
    },
  }

  /**
   * @param context
   * @param options
   * @override
   */
  async _prepareTabContext(context) {
    context.tabs = Object.entries(this.TABS).reduce((obj, [k, v]) => {
      if (k === "scenes" && !game.user.isGM) return obj
      const expanded = obj
      expanded[k] = { ...v }
      expanded[k].active = this.tabGroups.primary === k
      return expanded
    }, {})
  }
}
