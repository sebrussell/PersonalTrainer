export function formatAvailableTime(minutes) {
  return Number(minutes) >= 480 ? 'all day' : `${minutes} minutes`
}

export function formatTodayDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date)
}