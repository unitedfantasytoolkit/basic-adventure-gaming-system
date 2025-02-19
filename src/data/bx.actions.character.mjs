import { actionsFactory } from "../common/action.fields.mjs"

const createExplorationSkillAction = (
  id,
  { name, description, img, isBlind, flavorText, target },
) => {
  const action = actionsFactory().element.getInitialValue()

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
      flavorText: flavorText || action.flavorText,
      roll: {
        ...action.attempt.roll,
        operator: "<=",
        target,
      },
    },
  }
}

const characterActions = [
  createExplorationSkillAction("open-stuck-door", {
    name: "BAGS.Systems.BX.Exploration.OpenDoors.Label",
    description: "BAGS.Systems.BX.Exploration.OpenDoors.Description",
    img: "systems/basic-adventure-gaming-system/assets/icons/bx.actions.open-stuck-door.svg",
    isBlind: false,
    flavorText: {
      attempt: "BAGS.Systems.BX.Exploration.OpenDoors.AttemptText",
      success: "BAGS.Systems.BX.Exploration.OpenDoors.SuccessText",
      fail: "BAGS.Systems.BX.Exploration.OpenDoors.FailText",
      blind: "BAGS.Systems.BX.Exploration.OpenDoors.BlindText",
    },
    target: "@abilityScores.str.openDoors",
  }),
  createExplorationSkillAction("listen-at-doors", {
    name: "BAGS.Systems.BX.Exploration.ListenAtDoors.Label",
    description: "BAGS.Systems.BX.Exploration.ListenAtDoors.Description",
    img: "systems/basic-adventure-gaming-system/assets/icons/bx.actions.listen-at-door.svg",
    isBlind: true,
    flavorText: {
      attempt: "BAGS.Systems.BX.Exploration.ListenAtDoors.AttemptText",
      success: "BAGS.Systems.BX.Exploration.ListenAtDoors.SuccessText",
      fail: "BAGS.Systems.BX.Exploration.ListenAtDoors.FailText",
      blind: "BAGS.Systems.BX.Exploration.ListenAtDoors.BlindText",
    },
    target: "@modifiers.explorationSkills.listenAtDoors",
  }),
  createExplorationSkillAction("find-secret-doors", {
    name: "BAGS.Systems.BX.Exploration.FindSecretDoors.Label",
    description: "BAGS.Systems.BX.Exploration.FindSecretDoors.Description",
    img: "systems/basic-adventure-gaming-system/assets/icons/bx.actions.find-secret-door.svg",
    isBlind: true,
    flavorText: {
      attempt: "BAGS.Systems.BX.Exploration.FindSecretDoors.AttemptText",
      success: "BAGS.Systems.BX.Exploration.FindSecretDoors.SuccessText",
      fail: "BAGS.Systems.BX.Exploration.FindSecretDoors.FailText",
      blind: "BAGS.Systems.BX.Exploration.FindSecretDoors.BlindText",
    },
    target: "@modifiers.explorationSkills.findSecretDoors",
  }),
  createExplorationSkillAction("find-traps", {
    name: "BAGS.Systems.BX.Exploration.FindTraps.Label",
    description: "BAGS.Systems.BX.Exploration.FindTraps.Description",
    img: "systems/basic-adventure-gaming-system/assets/icons/bx.actions.find-trap.svg",
    isBlind: true,
    flavorText: {
      attempt: "BAGS.Systems.BX.Exploration.FindTraps.AttemptText",
      success: "BAGS.Systems.BX.Exploration.FindTraps.SuccessText",
      fail: "BAGS.Systems.BX.Exploration.FindTraps.FailText",
      blind: "BAGS.Systems.BX.Exploration.FindTraps.BlindText",
    },
    target: "@modifiers.explorationSkills.findTraps",
  }),
]

export default characterActions
