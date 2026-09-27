function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value)
  const safeText = typeof value === 'string' && /^[\t\r\n ]*[=+@-]/.test(text)
    ? `'${text}`
    : text

  return `"${safeText.replaceAll('"', '""')}"`
}

function toCsv(rows) {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

function flattenSettings(value, path, rows) {
  if (Array.isArray(value)) {
    if (value.some((item) => item !== null && typeof item === 'object')) {
      value.forEach((item, index) => flattenSettings(item, `${path}[${index + 1}]`, rows))
    } else {
      rows.push([path, value.join('; ')])
    }
    return
  }

  if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      flattenSettings(item, path ? `${path}.${key}` : key, rows)
    })
    return
  }

  rows.push([path, value ?? ''])
}

export function createHistoryCsv(history) {
  return toCsv([
    ['Activity', 'Duration (minutes)', 'Completed at'],
    ...history.map((session) => [
      session.activity || session.title || '',
      session.duration ?? '',
      session.completedAt || session.time || '',
    ]),
  ])
}

export function createSettingsCsv(settings) {
  const rows = [['Preference', 'Value']]
  flattenSettings(settings, '', rows)
  return toCsv(rows)
}