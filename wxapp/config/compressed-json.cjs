const { deflateSync } = require('node:zlib')

// Keep data synchronous for existing stores/calculators. Only the code-package
// representation changes; JSON values and the shared App sources stay intact.
module.exports = function compressedJson(source) {
  const json = JSON.stringify(JSON.parse(source))
  if (Buffer.byteLength(json) < 8192) return `module.exports = ${json};`
  const payload = deflateSync(Buffer.from(json), { level: 9 }).toString('base64')
  return `const { unzlibSync, strFromU8 } = require('fflate');
module.exports = JSON.parse(strFromU8(unzlibSync(new Uint8Array(wx.base64ToArrayBuffer(${JSON.stringify(payload)})))));`
}
