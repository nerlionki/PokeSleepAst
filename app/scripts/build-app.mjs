import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { versionCode } from '../src/update/version.ts'

const appRoot = path.resolve(import.meta.dirname, '..')
const projectName = path.basename(path.resolve(appRoot, '..'))
const target = (process.argv[2] ?? 'all').toLowerCase()
const mode = normalizeMode(process.argv[3] ?? 'debug')
const outDir = path.join(appRoot, 'release')
const appVersion = process.env.APP_VERSION ?? JSON.parse(readFileSync(path.join(appRoot, 'package.json'), 'utf8')).version
versionCode(appVersion)
process.env.APP_VERSION = appVersion

if (!['android', 'ios', 'all'].includes(target) || !mode) {
  console.error('用法: node scripts/build-app.mjs <android|ios|all> <debug|prod>')
  console.error('debug（deg）打调试包，prod 打生产包。包名使用项目名称。')
  process.exit(1)
}

function normalizeMode(value) {
  const name = value.toLowerCase()
  if (name === 'debug' || name === 'deg') return 'debug'
  if (name === 'prod' || name === 'release' || name === 'production') return 'prod'
  return ''
}

function run(command, args, cwd = appRoot, extraEnv = {}) {
  // Run npm and Capacitor through Node so Windows .cmd shim resolution is unambiguous.
  if (command === 'npm') {
    const candidates = [process.env.npm_execpath,
      path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'),
      path.resolve(path.dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js')]
    const cli = candidates.find((file) => file && existsSync(file))
    if (!cli) throw new Error('没有找到 npm，请通过 npm run 调用打包脚本')
    args = [cli, ...args]
    command = process.execPath
  } else if (command === 'npx') {
    args = [path.join(appRoot, 'node_modules/@capacitor/cli/bin/capacitor'), ...args.slice(1)]
    command = process.execPath
  }
  const windowsBatch = process.platform === 'win32' && command.endsWith('.bat')
  const quote = (value) => {
    if (/["\r\n%]/.test(value)) throw new Error('命令参数包含不支持的字符')
    return `"${value}"`
  }
  const result = windowsBatch ? spawnSync([command, ...args.map(quote)].join(' '), {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ...extraEnv },
  }) : spawnSync(command, args, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv } })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const MIN_JAVA = 21

function javaMajor(home) {
  const bin = process.platform === 'win32' ? 'java.exe' : 'java'
  if (!home || !existsSync(path.join(home, 'bin', bin))) return 0
  const release = path.join(home, 'release')
  const text = existsSync(release) ? readFileSync(release, 'utf8') : ''
  const version = text.match(/JAVA_VERSION="([\d.]+)/)?.[1] ?? path.basename(home).match(/(\d+)/)?.[1] ?? '0'
  const parts = version.split('.').map(Number)
  return parts[0] === 1 ? parts[1] : parts[0]
}

function javaHome() {
  const candidates = [process.env.JAVA_HOME ?? '']
  const roots = [
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Java',
    'C:\\Program Files\\Eclipse Adoptium',
  ]
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const name of readdirSync(root)) candidates.push(path.join(root, name))
  }
  const best = candidates
    .map((home) => ({ home, major: javaMajor(home) }))
    .filter((item) => item.major >= MIN_JAVA)
    .sort((a, b) => b.major - a.major)[0]
  return best?.home ?? ''
}

function publish(source, fileName) {
  if (!existsSync(source)) {
    console.error(`没有找到打包结果：${source}`)
    process.exit(1)
  }
  mkdirSync(outDir, { recursive: true })
  const dest = path.join(outDir, fileName)
  copyFileSync(source, dest)
  console.log(`安装包：${dest}`)
  return dest
}

function findApk(dir) {
  if (!existsSync(dir)) return ''
  const files = readdirSync(dir).filter((name) => name.endsWith('.apk'))
  const signed = files.find((name) => !name.includes('unsigned'))
  return signed ? path.join(dir, signed) : ''
}

function buildAndroid() {
  run('npx', ['cap', 'sync', 'android'])
  const home = javaHome()
  if (!home) {
    console.error(`没有找到 JDK ${MIN_JAVA} 或更高版本。请安装后再试，或把 JAVA_HOME 指向它。`)
    process.exit(1)
  }
  const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
  const task = mode === 'prod' ? 'assembleRelease' : 'assembleDebug'
  const env = { JAVA_HOME: home, PATH: `${path.join(home, 'bin')}${path.delimiter}${process.env.PATH ?? ''}` }
  run(gradlew, [task], path.join(appRoot, 'android'), env)
  const folder = mode === 'prod' ? 'release' : 'debug'
  const apk = findApk(path.join(appRoot, 'android', 'app', 'build', 'outputs', 'apk', folder))
  const dest = publish(apk, mode === 'prod' ? `PokeSleepAst-${appVersion}.apk` : `${projectName}-${mode}.apk`)
  if (mode === 'prod') {
    const manifest = { version: appVersion, versionCode: versionCode(appVersion), fileName: path.basename(dest),
      size: statSync(dest).size, sha256: createHash('sha256').update(readFileSync(dest)).digest('hex') }
    writeFileSync(path.join(outDir, 'update.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  }
}

function buildIos() {
  if (process.platform !== 'darwin') {
    console.error('iOS 应用要在 macOS 上用 Xcode 编译。当前系统只能打包安卓 APK。')
    process.exit(1)
  }
  run('npx', ['cap', 'sync', 'ios'])
  const project = path.join(appRoot, 'ios', 'App')
  const configuration = mode === 'prod' ? 'Release' : 'Debug'
  run('xcodebuild', [
    '-project', 'App.xcodeproj',
    '-scheme', 'App',
    '-destination', 'generic/platform=iOS Simulator',
    '-configuration', configuration,
    '-derivedDataPath', 'build',
    `PRODUCT_NAME=${projectName}`,
    'CODE_SIGNING_ALLOWED=NO',
  ], project)
  const app = path.join(project, 'build', 'Build', 'Products', `${configuration}-iphonesimulator`, `${projectName}.app`)
  console.log(`iOS ${mode} 应用：${app}`)
}

const wantIos = target === 'ios' || (target === 'all' && process.platform === 'darwin')
if (wantIos && process.platform !== 'darwin') {
  console.error('iOS 应用要在 macOS 上用 Xcode 编译。当前系统只能打包安卓 APK。')
  process.exit(1)
}

run('npm', ['run', 'build'])
if (target === 'android' || target === 'all') buildAndroid()
if (wantIos) buildIos()
if (target === 'all' && process.platform !== 'darwin') {
  console.log(`安卓 ${mode} 包已生成。iOS 需要换到 macOS 后再执行对应命令。`)
}
