/**
 *
 * @class
 * @classdesc [TODO:class]
 */
export default class WizardStepManager {
  #steps

  constructor(steps = {}) {
    this.#steps = Object.entries(steps).reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: { complete: false, current: false, valid: false, ...value },
      }),
      {},
    )
  }

  getCurrentStep() {
    return Object.entries(this.#steps).find(([_, step]) => step.current)?.[0]
  }

  setStepValidity(stepId, isValid) {
    if (this.#steps[stepId]) {
      this.#steps[stepId].valid = isValid
    }
  }

  moveToNext() {
    if (this.#currentIndex === -1) return false

    const nextIndex = this.#currentIndex + 1
    return nextIndex >= Object.keys(this.#steps).length
      ? false
      : this.#moveToIndex(nextIndex)
  }

  moveToPrevious() {
    if (this.#currentIndex === -1) return false

    const previousIndex = this.#currentIndex - 1
    return previousIndex <= Object.keys(this.#steps).length
      ? false
      : this.#moveToIndex(previousIndex, false)
  }

  #moveToIndex(index, currentStepStatus = true) {
    const currentIndex = this.#currentIndex

    this.#steps[Object.keys(this.#steps)[currentIndex]].current = false
    this.#steps[Object.keys(this.#steps)[currentIndex]].complete =
      currentStepStatus
    this.#steps[Object.keys(this.#steps)[index]].current = true
    return true
  }

  get #currentIndex() {
    return Object.keys(this.#steps).findIndex((key) => this.#steps[key].current)
  }

  get steps() {
    return { ...this.#steps }
  }
}
