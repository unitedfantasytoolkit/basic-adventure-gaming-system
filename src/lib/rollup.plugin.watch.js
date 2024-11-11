/**
 * @file A custom plugin to let the UI know if we're building in watch mode.
 */
let isWatchMode = false

export const watchMode = {
  name: "watch-mode",
  buildStart() {
    // The watch option is available in the this.meta object
    isWatchMode = this.meta.watchMode === true
  },
}

export const isWatch = () => isWatchMode
