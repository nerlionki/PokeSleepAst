import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const config = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../.signing/config.json'), 'utf8'))
const repository = 'nerlionki/PokeSleepAst'
// Secrets go through stdin, never through command line arguments or log output.
const secrets = {
  ANDROID_KEYSTORE_BASE64: readFileSync(config.storeFile).toString('base64'),
  ANDROID_KEYSTORE_PASSWORD: config.storePassword,
  ANDROID_KEY_ALIAS: config.keyAlias,
  ANDROID_KEY_PASSWORD: config.keyPassword,
}
const auth = spawnSync('gh', ['auth', 'status'], { stdio: 'ignore' })
if (auth.status !== 0) throw new Error('请先安装 GitHub CLI 并执行 gh auth login，确认账户有仓库 Secrets 管理权限。')
for (const [name, value] of Object.entries(secrets)) {
  const result = spawnSync('gh', ['secret', 'set', name, '--repo', repository], { input: value, stdio: ['pipe', 'ignore', 'pipe'] })
  if (result.status !== 0) throw new Error(`无法配置 ${name}，请检查仓库权限。`)
  console.log(`已配置 ${name}`)
}
