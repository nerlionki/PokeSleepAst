import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { posix } from 'node:path'
import { runInNewContext } from 'node:vm'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { imageLoaderShims, imageLoaderSource } = require('../../../wxapp/config/native-image-loader.cjs') as { imageLoaderShims: (files: Record<string, string>) => Record<string, string>; imageLoaderSource:(names:string[])=>string }

describe('WeChat image loader module paths', () => {
  it('declares literal async imports so the compiler retains every package module', () => {
    const source = imageLoaderSource(['asset-pack0','asset-pack10'])
    const dependencies = [...source.matchAll(/require\.async\(["']([^"']+)["']\)/g)].map(match => match[1])
    expect(dependencies).toEqual(['./asset-pack0/images.js','./asset-pack10/images.js'])
    expect(() => imageLoaderSource(['../escape'])).toThrow('Invalid image package')
  })
  it('generates a relative forwarder in every importing page directory', () => {
    const files = { 'pages/pokemon/index.js':'module.exports=require("./image-loader.js")', 'pages/data/index.js':"module.exports = require('./image-loader.js')", 'common.js':'module.exports=require("./image-loader.js")', 'other.js':'console.log(1)' }
    expect(imageLoaderShims(files)).toEqual({
      'pages/pokemon/image-loader.js':'module.exports = require("../../image-loader.js");\n',
      'pages/data/image-loader.js':'module.exports = require("../../image-loader.js");\n',
    })
  })
  it('resolves a page require and then its async resource path using WeChat module semantics', async () => {
    const files: Record<string,string> = {
      'pages/pokemon/index.js':'module.exports=require("./image-loader.js")',
      'image-loader.js':readFileSync(new URL('../../../wxapp/src/native/image-loader.js', import.meta.url),'utf8'),
      'asset-pack0/images.js':'module.exports={"berry/1.png":"YWJj"}',
    }
    Object.assign(files, imageLoaderShims(files))
    const asyncPaths: string[] = []
    function load(file: string): unknown {
      if (!(file in files)) throw Error(`module '${file}' is not defined`)
      const module = { exports:{} }
      const nativeRequire = Object.assign((arg: string) => load(posix.join(posix.dirname(file),arg)), { async:async (arg:string) => { const target=posix.join(posix.dirname(file),arg); asyncPaths.push(target); return load(target) } })
      runInNewContext(files[file],{ module, exports:module.exports, require:nativeRequire, Promise, Error })
      return module.exports
    }
    const loader = load('pages/pokemon/index.js') as {loadImageModule:(pack:string)=>Promise<unknown>}
    expect(await loader.loadImageModule('asset-pack0')).toEqual({ 'berry/1.png':'YWJj' })
    expect(asyncPaths).toEqual(['asset-pack0/images.js'])
  })
})
