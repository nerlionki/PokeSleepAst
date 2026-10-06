// Copied unchanged to the output root so require belongs to WeChat, not webpack.
exports.loadImageModule = function (name) {
  if (!/^asset-pack\d+$/.test(name)) return Promise.reject(new Error('Invalid image package'))
  if (typeof require.async !== 'function') return Promise.reject(new Error('当前微信不支持图片分包异步加载，请升级微信'))
  return require.async('./' + name + '/images.js')
}
