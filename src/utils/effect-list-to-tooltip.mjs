import html from "./html.mjs"

/**
 * Build the markup for a tooltip for a stat influenced by an Active Effect.
 * @param {unknown[]} effects - The effects applied to the aforementioned key.
 * @param {string} heading - A translation key that points to a long label for
 * the impacted stat
 * @param {string} flavor - A translation key that points to a description of
 * the affected stat
 * @returns {string} The tooltip to display.
 */
export default (effects, heading = "", flavor = "") => {
  if (!effects?.length) return ""

  const entryToListItem = ({ img, name, parent, modification }) => html`
    <div class="effect-modification">
      <img src="${img}" />
      <span class="effect-name">${name}</span>
      <span class="modification"
        >${modification.mode}: ${modification.value}</span
      >
      ${parent.name ? `<span class="source">(from ${parent.name})</span>` : ""}
    </div>
  `

  const formattedHeading = heading
    ? `<header>
      <h1>${game.i18n.localize(heading)}</h1>
    </header>
    <hr >
    `
    : ""
  const formattedFlavor = flavor ? `<p>${game.i18n.localize(flavor)}</p>` : ""

  console.info(effects)

  return html`
    <div class="enhanced-tooltip">
      ${formattedHeading}
      <main>${formattedFlavor}</main>
      ${effects.map(entryToListItem).join("")}
    </div>
  `
}
