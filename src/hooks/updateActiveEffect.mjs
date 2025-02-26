Hooks.on("updateActiveEffect", (effect) => {
  const { parent } = effect
  const effectListEditor = parent?.sheet?.subApps?.activeEffectEditor

  if (effectListEditor.rendered) effectListEditor.render(true)
})

