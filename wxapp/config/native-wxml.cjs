// WXML treats input as XML, while an HTML minifier strips its closing slash.
function compactWxml(source) {
  return source.replace(/>[ \t]*\r?\n[ \t]*(?=<)/g, '>')
}

class NativeWxmlPlugin {
  apply(compiler) {
    const name = 'NativeWxmlPlugin'
    compiler.hooks.thisCompilation.tap(name, compilation => {
      compilation.hooks.processAssets.tap({
        name,
        stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE,
      }, () => {
        const asset = compilation.getAsset('base.wxml')
        if (asset) compilation.updateAsset(asset.name, new compiler.webpack.sources.RawSource(compactWxml(asset.source.source().toString())))
      })
    })
  }
}

module.exports = { NativeWxmlPlugin }
