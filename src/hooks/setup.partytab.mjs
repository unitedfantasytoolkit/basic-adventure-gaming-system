/**
 * @file Overwrite the default Foundry tabbed sidebar for GM users
 * by adding a party list.
 */

/**
 * If everything checks out, rerender the sidebar UI to account for party member
 * updates.
 * @param {foundry.abstract.Document} doc - The Foundry document that triggered
 * the check.
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
