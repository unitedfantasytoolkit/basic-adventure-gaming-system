// modules/ui/dice-animation.mjs
const animatedDiceRoll = async (element, roll, options = {}) => {
  const { duration = 50, steps = 6, minValue = 3, maxValue = 18 } = options

  const valueContainer = element.querySelector(".value")
  element.classList.add("rolling")

  // Animate random numbers
  for (let i = 0; i < steps; i++) {
    const randomNum =
      Math.floor(Math.random() * (maxValue - minValue)) + minValue
    valueContainer.textContent = randomNum
    await new Promise((resolve) => setTimeout(resolve, duration))
  }

  // Show final number
  element.classList.remove("rolling")
  element.classList.add("complete")
  valueContainer.textContent = roll.total
}

export default animatedDiceRoll
