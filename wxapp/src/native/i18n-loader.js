// Literal async dependency must remain visible to WeChat's compiler.
exports.load = function () {
  if (typeof require.async !== 'function') return Promise.reject(new Error('当前微信不支持文案分包异步加载，请升级微信'))
  return require.async('./i18n-pack/i18n.js')
}
