export function getDataQualityColor(score) {
  if (typeof score !== 'number') return 'gray';
  if (score < 50) return 'red';
  if (score < 75) return 'yellow';
  return 'green';
}

export function getSeverityBadgeColor(severity) {
  switch ((severity || '').toLowerCase()) {
    case 'high': return 'red';
    case 'medium': return 'yellow';
    case 'low': return 'green';
    default: return 'gray';
  }
}
