import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const directory = path.resolve(import.meta.dirname, '../.signing')
const file = path.join(directory, 'release.jks')
const config = path.join(directory, 'config.json')
if (existsSync(file) || existsSync(config)) throw new Error('签名文件已存在，禁止覆盖。请备份并持续使用现有密钥。')
mkdirSync(directory, { recursive: true })
const password = randomBytes(32).toString('hex')
const result = spawnSync('keytool', ['-genkeypair', '-keystore', file, '-storetype', 'JKS', '-alias', 'pokesleepast',
  '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000', '-dname', 'CN=PokeSleepAst',
  '-storepass:env', 'POKESLEEP_SIGNING_PASSWORD', '-keypass:env', 'POKESLEEP_SIGNING_PASSWORD'],
{ stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, POKESLEEP_SIGNING_PASSWORD: password } })
if (result.status !== 0) throw new Error('创建签名密钥失败，请确认 JDK keytool 已加入 PATH。')
writeFileSync(config, JSON.stringify({ storeFile: file, storePassword: password, keyAlias: 'pokesleepast', keyPassword: password }, null, 2), { mode: 0o600 })
console.log(`正式签名已创建：${directory}\n请将整个目录备份到安全位置；密钥及密码不加入 Git。`)
