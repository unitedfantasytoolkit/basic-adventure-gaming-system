import { actionsFactory } from "../common/action.fields.mjs"

const createExplorationSkillAction = (id, name, description, img, isBlind) => {
  const action = actionsFactory().element.initial()

  return {
    ...action,
    id,
    name,
    description,
    img,
    flags: {
      ...action.flags,
      isBlind,
    },
    attempt: {
      ...action.attempt,
      roll: {
        ...action.attempt.roll,
        operator: "<=",
        target: "@abilityScores.str.openDoors",
      },
    },
  }
}

const characterActions = [
  createExplorationSkillAction(
    "open-stuck-door",
    "BAGS.Systems.BX.Exploration.OpenDoors.Label",
    "BAGS.Systems.BX.Exploration.OpenDoors.Description",
    "systems/basic-adventure-gaming-system/assets/icons/default-action.svg",
    false,
  ),
  createExplorationSkillAction(
    "listen-at-doors",
    "BAGS.Systems.BX.Exploration.ListenAtDoors.Label",
    "BAGS.Systems.BX.Exploration.ListenAtDoors.Description",
    "systems/basic-adventure-gaming-system/assets/icons/default-action.svg",
    true,
  ),
  createExplorationSkillAction(
    "find-secret-doors",
    "BAGS.Systems.BX.Exploration.FindSecretDoors.Label",
    "BAGS.Systems.BX.Exploration.FindSecretDoors.Description",
    "systems/basic-adventure-gaming-system/assets/icons/default-action.svg",
    true,
  ),
  createExplorationSkillAction(
    "find-traps",
    "BAGS.Systems.BX.Exploration.FindTraps.Label",
    "BAGS.Systems.BX.Exploration.FindTraps.Description",
    "systems/basic-adventure-gaming-system/assets/icons/default-action.svg",
    true,
  ),
]

export default characterActions
