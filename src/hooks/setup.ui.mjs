import PartySidebar from "../party/sidebar.mjs"
import BAGSSidebar from "../sidebar/sidebar.mjs"

/**
 * Override Foundry's tabbed sidebar UI with one that includes a Party tab.
 */
Hooks.once("setup", () => {
  CONFIG.ui.party = PartySidebar
  CONFIG.ui.sidebar = BAGSSidebar
})
