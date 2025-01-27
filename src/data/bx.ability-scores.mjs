/**
 * A Map of possible strength scores to modifiers.
 */
export const strengthModifiers = new Map()
strengthModifiers.set(0, { meleeAttack: -3, meleeDamage: -3, openDoors: 0 })
strengthModifiers.set(1, { meleeAttack: -3, meleeDamage: -3, openDoors: 1 })
strengthModifiers.set(2, { meleeAttack: -3, meleeDamage: -3, openDoors: 1 })
strengthModifiers.set(3, { meleeAttack: -3, meleeDamage: -3, openDoors: 1 })
strengthModifiers.set(4, { meleeAttack: -2, meleeDamage: -2, openDoors: 1 })
strengthModifiers.set(5, { meleeAttack: -2, meleeDamage: -2, openDoors: 1 })
strengthModifiers.set(6, { meleeAttack: -1, meleeDamage: -1, openDoors: 1 })
strengthModifiers.set(7, { meleeAttack: -1, meleeDamage: -1, openDoors: 1 })
strengthModifiers.set(8, { meleeAttack: -1, meleeDamage: -1, openDoors: 1 })
strengthModifiers.set(9, { meleeAttack: 0, meleeDamage: 0, openDoors: 2 })
strengthModifiers.set(10, { meleeAttack: 0, meleeDamage: 0, openDoors: 2 })
strengthModifiers.set(11, { meleeAttack: 0, meleeDamage: 0, openDoors: 2 })
strengthModifiers.set(12, { meleeAttack: 0, meleeDamage: 0, openDoors: 2 })
strengthModifiers.set(13, { meleeAttack: 1, meleeDamage: 1, openDoors: 3 })
strengthModifiers.set(14, { meleeAttack: 1, meleeDamage: 1, openDoors: 3 })
strengthModifiers.set(15, { meleeAttack: 1, meleeDamage: 1, openDoors: 3 })
strengthModifiers.set(16, { meleeAttack: 2, meleeDamage: 2, openDoors: 4 })
strengthModifiers.set(17, { meleeAttack: 2, meleeDamage: 2, openDoors: 4 })
strengthModifiers.set(18, { meleeAttack: 3, meleeDamage: 3, openDoors: 5 })

/**
 * A Map of possible intelligence scores to modifiers.
 */
export const intelligenceModifiers = new Map()
intelligenceModifiers.set(0, { languages: 0, literacy: -1 })
intelligenceModifiers.set(1, { languages: 0, literacy: -1 })
intelligenceModifiers.set(2, { languages: 0, literacy: -1 })
intelligenceModifiers.set(3, { languages: 0, literacy: -1 })
intelligenceModifiers.set(4, { languages: 0, literacy: -1 })
intelligenceModifiers.set(5, { languages: 0, literacy: -1 })
intelligenceModifiers.set(6, { languages: 0, literacy: 0 })
intelligenceModifiers.set(7, { languages: 0, literacy: 0 })
intelligenceModifiers.set(8, { languages: 0, literacy: 0 })
intelligenceModifiers.set(9, { languages: 0, literacy: 1 })
intelligenceModifiers.set(10, { languages: 0, literacy: 1 })
intelligenceModifiers.set(11, { languages: 0, literacy: 1 })
intelligenceModifiers.set(12, { languages: 0, literacy: 1 })
intelligenceModifiers.set(13, { languages: 1, literacy: 1 })
intelligenceModifiers.set(14, { languages: 1, literacy: 1 })
intelligenceModifiers.set(15, { languages: 1, literacy: 1 })
intelligenceModifiers.set(16, { languages: 2, literacy: 1 })
intelligenceModifiers.set(17, { languages: 2, literacy: 1 })
intelligenceModifiers.set(18, { languages: 3, literacy: 1 })

/**
 * A Map of possible wisdom scores to modifiers.
 */
export const wisdomModifiers = new Map()
wisdomModifiers.set(0, { magicSave: -3 })
wisdomModifiers.set(1, { magicSave: -3 })
wisdomModifiers.set(2, { magicSave: -3 })
wisdomModifiers.set(3, { magicSave: -3 })
wisdomModifiers.set(4, { magicSave: -2 })
wisdomModifiers.set(5, { magicSave: -2 })
wisdomModifiers.set(6, { magicSave: -1 })
wisdomModifiers.set(7, { magicSave: -1 })
wisdomModifiers.set(8, { magicSave: -1 })
wisdomModifiers.set(9, { magicSave: 0 })
wisdomModifiers.set(10, { magicSave: 0 })
wisdomModifiers.set(11, { magicSave: 0 })
wisdomModifiers.set(12, { magicSave: 0 })
wisdomModifiers.set(13, { magicSave: 1 })
wisdomModifiers.set(14, { magicSave: 1 })
wisdomModifiers.set(15, { magicSave: 1 })
wisdomModifiers.set(16, { magicSave: 2 })
wisdomModifiers.set(17, { magicSave: 2 })
wisdomModifiers.set(18, { magicSave: 3 })

/**
 * A Map of possible dexterity scores to modifiers.
 */
export const dexterityModifiers = new Map()
dexterityModifiers.set(0, {
  missileAttack: -3,
  missileDamage: -3,
  ac: -3,
  initiative: -2,
})
dexterityModifiers.set(1, {
  missileAttack: -3,
  missileDamage: -3,
  ac: -3,
  initiative: -2,
})
dexterityModifiers.set(2, {
  missileAttack: -3,
  missileDamage: -3,
  ac: -3,
  initiative: -2,
})
dexterityModifiers.set(3, {
  missileAttack: -3,
  missileDamage: -3,
  ac: -3,
  initiative: -2,
})
dexterityModifiers.set(4, {
  missileAttack: -2,
  missileDamage: -2,
  ac: -2,
  initiative: -1,
})
dexterityModifiers.set(5, {
  missileAttack: -2,
  missileDamage: -2,
  ac: -2,
  initiative: -1,
})
dexterityModifiers.set(6, {
  missileAttack: -1,
  missileDamage: -1,
  ac: -1,
  initiative: -1,
})
dexterityModifiers.set(7, {
  missileAttack: -1,
  missileDamage: -1,
  ac: -1,
  initiative: -1,
})
dexterityModifiers.set(8, {
  missileAttack: -1,
  missileDamage: -1,
  ac: -1,
  initiative: -1,
})
dexterityModifiers.set(9, {
  missileAttack: 0,
  missileDamage: 0,
  ac: 0,
  initiative: 0,
})
dexterityModifiers.set(10, {
  missileAttack: 0,
  missileDamage: 0,
  ac: 0,
  initiative: 0,
})
dexterityModifiers.set(11, {
  missileAttack: 0,
  missileDamage: 0,
  ac: 0,
  initiative: 0,
})
dexterityModifiers.set(12, {
  missileAttack: 0,
  missileDamage: 0,
  ac: 0,
  initiative: 0,
})
dexterityModifiers.set(13, {
  missileAttack: 1,
  missileDamage: 1,
  ac: 1,
  initiative: 1,
})
dexterityModifiers.set(14, {
  missileAttack: 1,
  missileDamage: 1,
  ac: 1,
  initiative: 1,
})
dexterityModifiers.set(15, {
  missileAttack: 1,
  missileDamage: 1,
  ac: 1,
  initiative: 1,
})
dexterityModifiers.set(16, {
  missileAttack: 2,
  missileDamage: 2,
  ac: 2,
  initiative: 1,
})
dexterityModifiers.set(17, {
  missileAttack: 2,
  missileDamage: 2,
  ac: 2,
  initiative: 1,
})
dexterityModifiers.set(18, {
  missileAttack: 3,
  missileDamage: 3,
  ac: 3,
  initiative: 2,
})

/**
 * A Map of possible constitution scores to modifiers.
 */
export const constitutionModifiers = new Map()
constitutionModifiers.set(0, { bonusHP: -3 })
constitutionModifiers.set(1, { bonusHP: -3 })
constitutionModifiers.set(2, { bonusHP: -3 })
constitutionModifiers.set(3, { bonusHP: -3 })
constitutionModifiers.set(4, { bonusHP: -2 })
constitutionModifiers.set(5, { bonusHP: -2 })
constitutionModifiers.set(6, { bonusHP: -1 })
constitutionModifiers.set(7, { bonusHP: -1 })
constitutionModifiers.set(8, { bonusHP: -1 })
constitutionModifiers.set(9, { bonusHP: 0 })
constitutionModifiers.set(10, { bonusHP: 0 })
constitutionModifiers.set(11, { bonusHP: 0 })
constitutionModifiers.set(12, { bonusHP: 0 })
constitutionModifiers.set(13, { bonusHP: 1 })
constitutionModifiers.set(14, { bonusHP: 1 })
constitutionModifiers.set(15, { bonusHP: 1 })
constitutionModifiers.set(16, { bonusHP: 2 })
constitutionModifiers.set(17, { bonusHP: 2 })
constitutionModifiers.set(18, { bonusHP: 3 })

/**
 * A Map of possible charisma scores to modifiers.
 */
export const charismaModifiers = new Map()
charismaModifiers.set(0, { reaction: -2, maxRetainers: 1, baseLoyalty: 4 })
charismaModifiers.set(1, { reaction: -2, maxRetainers: 1, baseLoyalty: 4 })
charismaModifiers.set(2, { reaction: -2, maxRetainers: 1, baseLoyalty: 4 })
charismaModifiers.set(3, { reaction: -2, maxRetainers: 1, baseLoyalty: 4 })
charismaModifiers.set(4, { reaction: -1, maxRetainers: 2, baseLoyalty: 5 })
charismaModifiers.set(5, { reaction: -1, maxRetainers: 2, baseLoyalty: 5 })
charismaModifiers.set(6, { reaction: -1, maxRetainers: 3, baseLoyalty: 6 })
charismaModifiers.set(7, { reaction: -1, maxRetainers: 3, baseLoyalty: 6 })
charismaModifiers.set(8, { reaction: -1, maxRetainers: 3, baseLoyalty: 6 })
charismaModifiers.set(9, { reaction: 0, maxRetainers: 4, baseLoyalty: 7 })
charismaModifiers.set(10, { reaction: 0, maxRetainers: 4, baseLoyalty: 7 })
charismaModifiers.set(11, { reaction: 0, maxRetainers: 4, baseLoyalty: 7 })
charismaModifiers.set(12, { reaction: 0, maxRetainers: 4, baseLoyalty: 7 })
charismaModifiers.set(13, { reaction: 1, maxRetainers: 5, baseLoyalty: 8 })
charismaModifiers.set(14, { reaction: 1, maxRetainers: 5, baseLoyalty: 8 })
charismaModifiers.set(15, { reaction: 1, maxRetainers: 5, baseLoyalty: 8 })
charismaModifiers.set(16, { reaction: 1, maxRetainers: 6, baseLoyalty: 9 })
charismaModifiers.set(17, { reaction: 1, maxRetainers: 6, baseLoyalty: 9 })
charismaModifiers.set(18, { reaction: 2, maxRetainers: 7, baseLoyalty: 10 })

// =============================================================================
/**
 * A map of ability score keys to modifiers, labels, field hints, and other
 * related data.
 */
const abilityScores = new Map()

abilityScores.set("str", {
  modifiers: strengthModifiers,
  label: "BAGS.Systems.BX.AbilityScores.str.Label",
  hint: "BAGS.Systems.BX.AbilityScores.str.Hint",
})
abilityScores.set("int", {
  modifiers: intelligenceModifiers,
  label: "BAGS.Systems.BX.AbilityScores.int.Label",
  hint: "BAGS.Systems.BX.AbilityScores.int.Hint",
})
abilityScores.set("wis", {
  modifiers: wisdomModifiers,
  label: "BAGS.Systems.BX.AbilityScores.wis.Label",
  hint: "BAGS.Systems.BX.AbilityScores.wis.Hint",
})
abilityScores.set("dex", {
  modifiers: dexterityModifiers,
  label: "BAGS.Systems.BX.AbilityScores.dex.Label",
  hint: "BAGS.Systems.BX.AbilityScores.dex.Hint",
})
abilityScores.set("con", {
  modifiers: constitutionModifiers,
  label: "BAGS.Systems.BX.AbilityScores.con.Label",
  hint: "BAGS.Systems.BX.AbilityScores.con.Hint",
})
abilityScores.set("cha", {
  modifiers: charismaModifiers,
  label: "BAGS.Systems.BX.AbilityScores.cha.Label",
  hint: "BAGS.Systems.BX.AbilityScores.cha.Hint",
})

export default abilityScores
