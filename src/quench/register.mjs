/**
 * @file Hands the integration test batches to Quench, if Quench is there.
 *
 * This file is the only part of the test suite the system imports at startup, and
 * it is deliberately tiny: the batches themselves are pulled in with a dynamic
 * import, which rollup emits as a separate chunk. A world without Quench never
 * fires `quenchReady`, so it never downloads or parses a line of test code.
 *
 * The import is awaited inside the hook rather than at the top of the file
 * because `quenchReady` fires during `setup`, long before anyone can click "Run"
 * -- there is plenty of time to fetch a chunk and register the batches.
 */

Hooks.on("quenchReady", async (quench) => {
  try {
    const { default: registerQuenchBatches } = await import("./index.mjs")
    registerQuenchBatches(quench)
  } catch (error) {
    // A failure here means the batches are missing, not that the world is
    // broken. Say so and let Foundry carry on.
    console.error("BAGS | Could not register Quench test batches", error)
  }
})
