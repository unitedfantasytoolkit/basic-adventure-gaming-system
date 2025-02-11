/**
 * Given an amount of seconds, convert it to a human-readable format.
 * @param {number} seconds - The number of seconds to convert.
 * @returns {string} A string, formatted as years/months/days/hours/minutes/
 * seconds.
 */
export default (seconds) => {
  if (!seconds || seconds < 0)
    return `0${game.i18n.localize("TIME.SecondsAbbreviation")}`

  // Define time unit configuration
  const getTimeUnits = () => {
    if (game.modules.get("simple-calendar")?.active && SimpleCalendar?.api) {
      const SC = SimpleCalendar.api
      const timeSettings = SC.getTimeConfiguration()
      const dateSettings = SC.getDateConfiguration()

      return {
        second: 1,
        minute: timeSettings.secondsInMinute,
        hour: timeSettings.secondsInMinute * timeSettings.minutesInHour,
        day:
          timeSettings.secondsInMinute *
          timeSettings.minutesInHour *
          timeSettings.hoursInDay,
        month:
          timeSettings.secondsInMinute *
          timeSettings.minutesInHour *
          timeSettings.hoursInDay *
          dateSettings.daysInMonth,
        year:
          timeSettings.secondsInMinute *
          timeSettings.minutesInHour *
          timeSettings.hoursInDay *
          dateSettings.daysInMonth *
          dateSettings.monthsInYear,
      }
    }

    return {
      second: 1,
      minute: 60,
      hour: 3600,
      day: 86400,
      month: 2592000, // 30 days
      year: 31536000, // 365 days
    }
  }

  const units = [
    { name: "year", key: "TIME.YearsAbbreviation" },
    { name: "month", key: "TIME.MonthsAbbreviation" },
    { name: "day", key: "TIME.DaysAbbreviation" },
    { name: "hour", key: "TIME.HoursAbbreviation" },
    { name: "minute", key: "TIME.MinutesAbbreviation" },
    { name: "second", key: "TIME.SecondsAbbreviation" },
  ]

  const timeUnits = getTimeUnits()
  let remainingSeconds = seconds
  const parts = []

  // Calculate and format each time unit

  units.forEach((unit) => {
    if (remainingSeconds >= timeUnits[unit.name]) {
      const value = Math.floor(remainingSeconds / timeUnits[unit.name])
      if (value > 0) {
        parts.push(`${value}${game.i18n.localize(unit.key)}`)
      }
      remainingSeconds %= timeUnits[unit.name]
    }
  })

  // If no parts were added, show 0 seconds
  return parts.length
    ? parts.join(" ")
    : `0${game.i18n.localize("TIME.SecondsAbbreviation")}`
}
