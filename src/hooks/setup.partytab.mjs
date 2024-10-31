/**
 * @file Overwrite the default Foundry tabbed sidebar for GM users
 * by adding a party list.
 */

import PartySidebar from "../party/sidebar.mjs"

/**
 * Override Foundry's tabbed sidebar UI with one that includes a Party tab.
 */
async function setupPartySidebar() {
  // CONFIG.ui.party = PartySidebar
  // class OverrideSidebar extends CONFIG.ui.sidebar {
  //   getData(options = {}) {
  //     const data = super.getData(options)
  //     const { chat, combat, ...tabs } = data.tabs
  //     const orderedTabs = {
  //       chat,
  //       combat,
  //       party: {
  //         tooltip: PartySidebar.tooltip,
  //         icon: PartySidebar.icon,
  //       },
  //       ...tabs,
  //     }
  //     data.tabs = orderedTabs
  //     return data
  //   }
  // }

  // if (game.user.isGM) {
  //   CONFIG.ui.party = PartySidebar
  //   CONFIG.ui.sidebar = OverrideSidebar
  // }
}

/**
 * If everything checks out, rerender the sidebar UI to account for party member updates.
 * @param {foundry.abstract.Document} doc - The Foundry document that triggered the check.
 */
const conditionallyRenderSidebar = (doc) => {
  if (
    doc?.documentName === "Item" &&
    doc?.parent?.documentName === "Actor" &&
    doc?.parent?.getFlag(game.system.id, "party")
  )
    ui.sidebar.render()

  if (doc?.documentName === "Actor" && doc.getFlag(game.system.id, "party"))
    ui.sidebar.render()
}

Hooks.on("updateActor", conditionallyRenderSidebar)
Hooks.on("createItem", conditionallyRenderSidebar)
Hooks.on("updateItem", conditionallyRenderSidebar)
Hooks.on("deleteItem", conditionallyRenderSidebar)

Hooks.once("setup", setupPartySidebar)
