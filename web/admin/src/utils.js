import qs from 'qs'

export function normalizeLng(x) {
  var lng = (x + 180) % 360 - 180
  if (lng < -180) lng += 360
  return lng
}

export function parseQueryString() {
  return qs.parse(document.location.search.substr(1))
}

export function openTab(url) {
  window.open(url, '_blank')
}