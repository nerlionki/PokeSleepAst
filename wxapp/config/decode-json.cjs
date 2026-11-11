const { unzlibSync, strFromU8 } = require('fflate')

module.exports = function decodeJson(payload) {
  const padding = Number(payload[0])
  const bytes = new Uint8Array((payload.length - 1) / 5 * 4 - padding)
  for (let source = 1, target = 0; source < payload.length; source += 5, target += 4) {
    let word = 0
    for (let index = source; index < source + 5; index++) {
      const code = payload.charCodeAt(index)
      word = word * 85 + code - 33 - (code >= 35 ? 1 : 0) - (code >= 93 ? 1 : 0)
    }
    bytes[target] = word >>> 24
    bytes[target + 1] = word >>> 16
    bytes[target + 2] = word >>> 8
    bytes[target + 3] = word
  }
  return JSON.parse(strFromU8(unzlibSync(bytes)))
}
