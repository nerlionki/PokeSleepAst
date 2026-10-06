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
    "asset-pack7": () => require.async("./asset-pack7/images.js")
  };
  if (!loaders[name]) return Promise.reject(new Error('Invalid image package'));
  return loaders[name]();
};

exports.loadModelChunk=function(name){const loaders={"ocr-pack0":()=>require.async("./ocr-pack0/images.js"),"ocr-pack1":()=>require.async("./ocr-pack1/images.js"),"ocr-pack2":()=>require.async("./ocr-pack2/images.js"),"ocr-pack3":()=>require.async("./ocr-pack3/images.js"),"ocr-pack4":()=>require.async("./ocr-pack4/images.js"),"ocr-pack5":()=>require.async("./ocr-pack5/images.js"),"ocr-pack6":()=>require.async("./ocr-pack6/images.js"),"ocr-pack7":()=>require.async("./ocr-pack7/images.js"),"ocr-pack8":()=>require.async("./ocr-pack8/images.js"),"ocr-pack9":()=>require.async("./ocr-pack9/images.js")};if(!loaders[name])return Promise.reject(new Error('Invalid model package'));return loaders[name]();};
