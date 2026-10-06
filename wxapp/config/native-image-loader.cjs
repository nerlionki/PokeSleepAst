const path = require('node:path').posix

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
module.exports = { NativeImageLoaderPlugin, imageLoaderShims }
