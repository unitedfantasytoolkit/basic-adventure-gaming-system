/**
 * @file Install the system's sidebar, and the tabs that go inside it.
 */

import BAGSCombatTracker from "../combat/sidebar/tracker.mjs"
import PartySidebar, { registerPartyHooks } from "../party/sidebar.mjs"
import RewardsSidebar from "../rewards/sidebar.mjs"
import BAGSSidebar from "../sidebar/sidebar.mjs"

Hooks.once("setup", () => {
  // Foundry builds the `ui` object by walking `CONFIG.ui` inside
  // `Game#initializeUI`, which runs after the `setup` hook has been called. That
  // makes this early enough to register both the sidebar and the tabs it holds,
  // and late enough that the documents those tabs read are available.
  CONFIG.ui.sidebar = BAGSSidebar
  CONFIG.ui.combat = BAGSCombatTracker
  CONFIG.ui.party = PartySidebar
  CONFIG.ui.rewards = RewardsSidebar

  registerPartyHooks()
})
