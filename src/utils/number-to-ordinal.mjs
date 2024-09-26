import html from "./html.mjs"

const numberToOrdinal = (value) => {
  const number = parseInt(value || "0", 10)
  if (!number) return ""
  const plurals = new Intl.PluralRules("en-US", { type: "ordinal" })
  const suffixes = new Map([
    ["one", game.i18n.localize("BAGS.Ordinal.one")],
    ["two", game.i18n.localize("BAGS.Ordinal.two")],
    ["few", game.i18n.localize("BAGS.Ordinal.few")],
    ["other", game.i18n.localize("BAGS.Ordinal.other")],
  ])
  const rule = plurals.select(number)
  const suffix = suffixes.get(rule)
  return html`<span class="ordinal">
    <span class="ordinal__digit">${number}</span
    ><span class="ordinal__suffix">${suffix}</span>
  </span>`
}

export default numberToOrdinal
