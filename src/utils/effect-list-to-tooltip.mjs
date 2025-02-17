import html from "./html.mjs"

export default (effects) => {
  if (!effects?.length) return ""

  const entryToListItem = (mod) => html`
    <div class="effect-modification">
      <img
        src="${mod.img}"
        width="16"
        height="16"
      />
      <span class="effect-name">${mod.name}</span>
      <span class="modification"
        >${mod.modification.mode}: ${mod.modification.value}</span
      >
      ${mod.parent.name
        ? `<span class="source">(from ${mod.parent.name})</span>`
        : ""}
    </div>
  `
  return html`
    <div class="enhanced-tooltip">${effects.map(entryToListItem).join("")}</div>
  `
}
