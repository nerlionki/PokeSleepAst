const { constants, deflateSync } = require('node:zlib')

function encodeBase85(bytes) {
  const padding = (4 - bytes.length % 4) % 4
  const source = padding ? Buffer.concat([bytes, Buffer.alloc(padding)]) : bytes
  let encoded = String(padding)
  for (let offset = 0; offset < source.length; offset += 4) {
    let word = source.readUInt32BE(offset)
    let block = ''
    for (let digitIndex = 0; digitIndex < 5; digitIndex++) {
      const digit = word % 85
      // Printable ASCII, skipping the double quote and backslash in JS literals.
      block = String.fromCharCode(33 + digit + (digit > 0 ? 1 : 0) + (digit >= 58 ? 1 : 0)) + block
      word = Math.floor(word / 85)
    }
    encoded += block
  }
  return encoded
}

// Keep data synchronous for existing stores/calculators. Only the code-package
// representation changes; JSON values and the shared App sources stay intact.
module.exports = function compressedJson(source) {
  const json = JSON.stringify(JSON.parse(source))
  const plain = `module.exports = ${json};`
  if (Buffer.byteLength(json) < 1024) return plain
  const input = Buffer.from(json)
  const normal = deflateSync(input, { level: 9 })
  const filtered = deflateSync(input, { level: 9, strategy: constants.Z_FILTERED })
  const shortWindow = deflateSync(input, { level: 9, strategy: constants.Z_FILTERED, windowBits: 13 })
  const smallest = [normal, filtered, shortWindow].reduce((best, candidate) => candidate.length < best.length ? candidate : best)
  const payload = encodeBase85(smallest)
  const compressed = `module.exports = require(${JSON.stringify(require.resolve('./decode-json.cjs'))})(${JSON.stringify(payload)});`
  // Include the decoding wrapper cost; small/incompressible tables stay plain.
  return Buffer.byteLength(compressed) < Buffer.byteLength(plain) ? compressed : plain
}
