const path = require('node:path').posix

function imageLoaderSource(names) {
  const entries = names.map(name => {
    if (!/^asset-pack\d+$/.test(name)) throw Error('Invalid image package')
    return `${JSON.stringify(name)}: () => require.async(${JSON.stringify(`./${name}/images.js`)})`
  })
  return `// Literal async dependencies must remain visible to WeChat's compiler.\nexports.loadImageModule = function (name) {\n  if (!/^asset-pack\\d+$/.test(name)) return Promise.reject(new Error('Invalid image package'))\n  if (typeof require.async !== 'function') return Promise.reject(new Error('当前微信不支持图片分包异步加载，请升级微信'))\n  const loaders = {\n    ${entries.join(',\n    ')}\n  };\n  if (!loaders[name]) return Promise.reject(new Error('Invalid image package'));\n  return loaders[name]();\n};\n`
}

// A native external require is relative to the emitted chunk, not the source
// module. Keep one root bridge and forward page-local requests to that bridge.
function imageLoaderShims(files) {
  const shims = {}
  for (const [file, source] of Object.entries(files)) {
    if (!file.endsWith('.js') || !/\brequire\s*\(\s*(['"])\.\/image-loader\.js\1\s*\)/.test(source)) continue
    const directory = path.dirname(file)
    if (directory === '.') continue
    shims[path.join(directory, 'image-loader.js')] = `module.exports = require(${JSON.stringify(path.relative(directory, 'image-loader.js'))});\n`
  }
  return shims
}

class NativeImageLoaderPlugin {
  apply(compiler) {
    const name = 'NativeImageLoaderPlugin'
    compiler.hooks.thisCompilation.tap(name, compilation => {
      compilation.hooks.processAssets.tap({ name, stage:compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE }, () => {
        const files = Object.fromEntries(compilation.getAssets().filter(asset => asset.name.endsWith('.js')).map(asset => [asset.name, asset.source.source().toString()]))
        for (const [file, source] of Object.entries(imageLoaderShims(files))) compilation.emitAsset(file, new compiler.webpack.sources.RawSource(source))
      })
    })
  }
}
module.exports = { NativeImageLoaderPlugin, imageLoaderShims, imageLoaderSource }
