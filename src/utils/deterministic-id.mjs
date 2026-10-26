/**
 * @file Derive a stable document id from a piece of text.
 *
 * This exists because "only the GM does this" is not the guarantee it looks
 * like. Foundry's `User#isActiveGM` is `this === game.users.activeGM` -- it
 * designates an active *User document*, not a session. A referee with the world
 * open on a laptop and a tablet is one User in two sessions, and both of them
 * answer `true`. Every piece of GM-gated bookkeeping then runs twice, and
 * anything that creates a document creates two.
 *
 * Checking whether the document already exists does not help: both sessions
 * check before either has finished writing. What does help is making the write
 * idempotent. If both sessions ask for the *same* id, the second attempt
 * collides and can be discarded, and the table ends up with one document
 * however many screens the referee is running.
 */

/** The alphabet Foundry document ids are drawn from. */
const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

/** How long a Foundry document id is. */
const ID_LENGTH = 16

/**
 * Turn a string into a stable Foundry document id.
 *
 * Not cryptographic, and it does not need to be: the only requirement is that
 * the same seed always gives the same id, and that different seeds within one
 * world are unlikely to collide. Two rounds of a 32-bit FNV-1a variant, walked
 * with different multipliers, gives enough spread for the handful of documents
 * a single encounter creates.
 * @param {string} seed - Anything that identifies the document uniquely, such
 * as `${combat.id}:${round}`.
 * @returns {string} A 16-character id built from Foundry's id alphabet.
 */
export default function deterministicId(seed) {
  /* eslint-disable no-bitwise -- A hash is arithmetic on bits; writing this
     without them would be slower, longer, and no clearer. */
  let hashA = 0x811c9dc5
  let hashB = 0x01000193

  for (let i = 0; i < seed.length; i += 1) {
    const code = seed.charCodeAt(i)
    hashA = Math.imul(hashA ^ code, 0x01000193) >>> 0
    hashB = Math.imul(hashB + code, 0x85ebca6b) >>> 0
  }

  let id = ""
  for (let i = 0; i < ID_LENGTH; i += 1) {
    // Advance both accumulators each round so the two halves of the id do not
    // repeat once the first has cycled.
    hashA = Math.imul(hashA ^ (hashA >>> 13), 0x01000193) >>> 0
    hashB = Math.imul(hashB ^ (hashB >>> 16), 0x85ebca6b) >>> 0

    // `^` yields a *signed* 32-bit integer even when both operands are
    // unsigned, so this is negative about half the time -- and a negative
    // remainder indexes off the front of the alphabet and gives `undefined`.
    // The result is an id made of the word "undefined", which Foundry quietly
    // discards in favour of a random one, defeating the whole point.
    id += ALPHABET[((hashA ^ hashB) >>> 0) % ALPHABET.length]
  }

  return id
}
/* eslint-enable no-bitwise */
