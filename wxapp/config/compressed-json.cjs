const { constants, deflateSync } = require('node:zlib')

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
  const payload = smallest.toString('base64')
  const compressed = `const { unzlibSync, strFromU8 } = require('fflate');
module.exports = JSON.parse(strFromU8(unzlibSync(new Uint8Array(wx.base64ToArrayBuffer(${JSON.stringify(payload)})))));`
  // Include the decoding wrapper cost; small/incompressible tables stay plain.
  return Buffer.byteLength(compressed) < Buffer.byteLength(plain) ? compressed : plain
}
