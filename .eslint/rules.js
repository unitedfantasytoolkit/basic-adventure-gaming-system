// --- Rules ------------------------------------------------------------------
// Note: these rules have been harvested from the base AirBnB config.
import jsdocRules from "./rules.jsdoc.js"
import errorRules from "./rules.errors.js"
import styleRules from "./rules.style.js"
// import importRules from "./rules.imports.js"
import variableRules from "./rules.variables.js"
import bestPracticeRules from "./rules.best-practices.js"

export default {
  "prettier/prettier": ["error"],
  ...jsdocRules,
  ...errorRules,
  ...styleRules,
  // ...importRules,
  ...variableRules,
  ...bestPracticeRules,
}
