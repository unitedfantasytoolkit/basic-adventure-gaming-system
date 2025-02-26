import globals from "globals"
import foundryGlobals from "./globals.foundry.js"

export default {
  ...globals.browser,
  ...foundryGlobals,
  process: "readonly",
  __DEV__: "readonly",
}
