import PartySidebar from "../party/sidebar.mjs"
import BAGSSidebar from "../sidebar/sidebar.mjs"

/**
 * Override Foundry's tabbed sidebar UI with one that includes a Party tab.
 * @TODO: v13.334 borked this. Get it working again.
 */
Hooks.once("setup", () => {
  // CONFIG.ui.party = PartySidebar
  // CONFIG.ui.sidebar = BAGSSidebar
})
