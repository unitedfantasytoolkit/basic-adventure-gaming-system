import BAGSCombatant from "./combatant"

export default class BAGSGroupCombatant extends BAGSCombatant {
  get group() {
    if (this.actor.system.isSlow) return "slow"

    return this.groupRaw
  }

  get groupRaw() {
    const assignedGroup = this.getFlag(game.system.id, "group")
    if (assignedGroup) return assignedGroup

    if (canvas.tokens) {
      const token = canvas.tokens.get(this.token.id)
      const { disposition } = token.document
      switch (disposition) {
        case -1:
          return "red"
        case 0:
          return "yellow"
        case 1:
          return "green"
      }
    }

    return "white"
  }

  set group(value) {
    this.setFlag(game.system.id, "group", value || "black")
  }
}
