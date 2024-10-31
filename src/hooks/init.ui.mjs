import PartySidebar from "../party/sidebar.mjs"
import Sidebar from "../sidebar/sidebar.mjs"

/**
 * Override Foundry's tabbed sidebar UI with one that includes a Party tab.
 */
Hooks.once("init", () => {
  CONFIG.ui.party = PartySidebar
  CONFIG.ui.sidebar = Sidebar
})
