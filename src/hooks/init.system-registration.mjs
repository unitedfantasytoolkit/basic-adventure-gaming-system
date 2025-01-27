import SystemRegistry from "../config/system-registry"

Hooks.once("init", async () => {
  // if (!CONFIG.BAGS) CONFIG.BAGS = {}
  //
  // CONFIG.BAGS.SystemRegistry = SystemRegistry
  //
  // await Hooks.callAll("BAGS.RegisterSystems", CONFIG.BAGS.SystemRegistry)
})
