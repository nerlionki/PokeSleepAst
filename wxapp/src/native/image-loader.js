// Literal async dependencies must remain visible to WeChat's compiler.
exports.loadImageModule = function (name) {
  if (!/^asset-pack\d+$/.test(name)) return Promise.reject(new Error('Invalid image package'))
  if (typeof require.async !== 'function') return Promise.reject(new Error('当前微信不支持图片分包异步加载，请升级微信'))
  const loaders = {
    "asset-pack0": () => require.async("./asset-pack0/images.js"),
    "asset-pack1": () => require.async("./asset-pack1/images.js"),
    "asset-pack2": () => require.async("./asset-pack2/images.js"),
    "asset-pack3": () => require.async("./asset-pack3/images.js"),
    "asset-pack4": () => require.async("./asset-pack4/images.js"),
    "asset-pack5": () => require.async("./asset-pack5/images.js"),
    "asset-pack6": () => require.async("./asset-pack6/images.js"),
    "asset-pack7": () => require.async("./asset-pack7/images.js"),
    "asset-pack8": () => require.async("./asset-pack8/images.js"),
    "asset-pack9": () => require.async("./asset-pack9/images.js"),
    "asset-pack10": () => require.async("./asset-pack10/images.js")
  };
  if (!loaders[name]) return Promise.reject(new Error('Invalid image package'));
  return loaders[name]();
};
