/* eslint-disable max-lines */
/**
 * @file Monster XP, save, and attack bonus/THAC0 offset info, mapped to HD
 */

const monsterStats = new Map()

monsterStats.set(0, {
  attackRollOffset: -1,
  saves: {
    death: 14,
    wands: 15,
    paralysis: 16,
    breath: 17,
    spells: 18,
  },
  xp: {
    base: 5,
    basePlus: 0,
    perHP: 0,
    perAbility: 1,
  },
})
monsterStats.set(1, {
  attackRollOffset: 0,
  saves: {
    death: 12,
    wands: 13,
    paralysis: 14,
    breath: 15,
    spells: 16,
  },
  xp: {
    base: 10,
    basePlus: 15,
    perHP: 0,
    perAbility: 3,
  },
})
monsterStats.set(2, {
  attackRollOffset: 1,
  saves: {
    death: 12,
    wands: 13,
    paralysis: 14,
    breath: 15,
    spells: 16,
  },
  xp: {
    base: 20,
    basePlus: 25,
    perHP: 0,
    perAbility: 5,
  },
})
monsterStats.set(3, {
  attackRollOffset: 2,
  saves: {
    death: 12,
    wands: 13,
    paralysis: 14,
    breath: 15,
    spells: 16,
  },
  xp: {
    base: 35,
    basePlus: 50,
    perHP: 0,
    perAbility: 15,
  },
})
monsterStats.set(4, {
  attackRollOffset: 3,
  saves: {
    death: 10,
    wands: 11,
    paralysis: 12,
    breath: 13,
    spells: 14,
  },
  xp: {
    base: 75,
    basePlus: 125,
    perHP: 0,
    perAbility: 50,
  },
})
monsterStats.set(5, {
  attackRollOffset: 4,
  saves: {
    death: 10,
    wands: 11,
    paralysis: 12,
    breath: 13,
    spells: 14,
  },
  xp: {
    base: 175,
    basePlus: 225,
    perHP: 0,
    perAbility: 125,
  },
})
monsterStats.set(6, {
  attackRollOffset: 5,
  saves: {
    death: 10,
    wands: 11,
    paralysis: 12,
    breath: 13,
    spells: 14,
  },
  xp: {
    base: 275,
    basePlus: 350,
    perHP: 0,
    perAbility: 225,
  },
})
monsterStats.set(7, {
  attackRollOffset: 6,
  saves: {
    death: 8,
    wands: 9,
    paralysis: 10,
    breath: 10,
    spells: 12,
  },
  xp: {
    base: 450,
    basePlus: 0,
    perHP: 0,
    perAbility: 400,
  },
})
monsterStats.set(8, {
  attackRollOffset: 6,
  saves: {
    death: 8,
    wands: 9,
    paralysis: 10,
    breath: 10,
    spells: 12,
  },
  xp: {
    base: 450,
    basePlus: 0,
    perHP: 0,
    perAbility: 400,
  },
})
monsterStats.set(9, {
  attackRollOffset: 7,
  saves: {
    death: 8,
    wands: 9,
    paralysis: 10,
    breath: 10,
    spells: 12,
  },
  xp: {
    base: 900,
    basePlus: 0,
    perHP: 0,
    perAbility: 700,
  },
})
monsterStats.set(10, {
  attackRollOffset: 8,
  saves: {
    death: 6,
    wands: 7,
    paralysis: 8,
    breath: 8,
    spells: 10,
  },
  xp: {
    base: 900,
    basePlus: 0,
    perHP: 0,
    perAbility: 700,
  },
})
monsterStats.set(11, {
  attackRollOffset: 8,
  saves: {
    death: 6,
    wands: 7,
    paralysis: 8,
    breath: 8,
    spells: 10,
  },
  xp: {
    base: 900,
    basePlus: 0,
    perHP: 0,
    perAbility: 700,
  },
})
monsterStats.set(12, {
  attackRollOffset: 9,
  saves: {
    death: 6,
    wands: 7,
    paralysis: 8,
    breath: 8,
    spells: 10,
  },
  xp: {
    base: 1100,
    basePlus: 0,
    perHP: 0,
    perAbility: 800,
  },
})
monsterStats.set(12, {
  attackRollOffset: 9,
  saves: {
    death: 6,
    wands: 7,
    paralysis: 8,
    breath: 8,
    spells: 10,
  },
  xp: {
    base: 1100,
    basePlus: 0,
    perHP: 0,
    perAbility: 800,
  },
})
monsterStats.set(13, {
  attackRollOffset: 9,
  saves: {
    death: 6,
    wands: 7,
    paralysis: 8,
    breath: 8,
    spells: 10,
  },
  xp: {
    base: 1100,
    basePlus: 0,
    perHP: 0,
    perAbility: 800,
  },
})
monsterStats.set(14, {
  attackRollOffset: 10,
  saves: {
    death: 6,
    wands: 7,
    paralysis: 8,
    breath: 8,
    spells: 10,
  },
  xp: {
    base: 1350,
    basePlus: 0,
    perHP: 0,
    perAbility: 950,
  },
})
monsterStats.set(15, {
  attackRollOffset: 10,
  saves: {
    death: 6,
    wands: 7,
    paralysis: 8,
    breath: 8,
    spells: 10,
  },
  xp: {
    base: 1350,
    basePlus: 0,
    perHP: 0,
    perAbility: 950,
  },
})
monsterStats.set(16, {
  attackRollOffset: 11,
  saves: {
    death: 2,
    wands: 3,
    paralysis: 4,
    breath: 3,
    spells: 6,
  },
  xp: {
    base: 1350,
    basePlus: 0,
    perHP: 0,
    perAbility: 950,
  },
})
monsterStats.set(17, {
  attackRollOffset: 11,
  saves: {
    death: 2,
    wands: 3,
    paralysis: 4,
    breath: 3,
    spells: 6,
  },
  xp: {
    base: 1350,
    basePlus: 0,
    perHP: 0,
    perAbility: 950,
  },
})
monsterStats.set(18, {
  attackRollOffset: 12,
  saves: {
    death: 2,
    wands: 3,
    paralysis: 4,
    breath: 3,
    spells: 6,
  },
  xp: {
    base: 2000,
    basePlus: 0,
    perHP: 0,
    perAbility: 1150,
  },
})
monsterStats.set(19, {
  attackRollOffset: 12,
  saves: {
    death: 2,
    wands: 3,
    paralysis: 4,
    breath: 3,
    spells: 6,
  },
  xp: {
    base: 2000,
    basePlus: 0,
    perHP: 0,
    perAbility: 1150,
  },
})
monsterStats.set(20, {
  attackRollOffset: 13,
  saves: {
    death: 2,
    wands: 3,
    paralysis: 4,
    breath: 3,
    spells: 6,
  },
  xp: {
    base: 2000,
    basePlus: 0,
    perHP: 0,
    perAbility: 1150,
  },
})
monsterStats.set(21, {
  attackRollOffset: 13,
  saves: {
    death: 2,
    wands: 3,
    paralysis: 4,
    breath: 3,
    spells: 6,
  },
  xp: {
    base: 2000,
    basePlus: 0,
    perHP: 0,
    perAbility: 1150,
  },
})
monsterStats.set(22, {
  attackRollOffset: 14,
  saves: {
    death: 2,
    wands: 2,
    paralysis: 2,
    breath: 2,
    spells: 2,
  },
  xp: {
    base: 2500,
    basePlus: 2000,
    perHP: 0,
    perAbility: 0,
  },
})

export default monsterStats
