import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { buildVersionCode, versionFromTag } from '../../app/src/update/version.ts'

const repo = process.env.GITHUB_REPOSITORY, tag = process.env.RELEASE_TAG, token = process.env.GH_TOKEN
const root = path.resolve(import.meta.dirname, '../..')
const version = versionFromTag(tag ?? '')
if (!repo || !token || !version || version !== JSON.parse(fs.readFileSync(path.join(root, 'app/package.json'))).version) throw Error('Invalid rebuild repository, tag, or package version')
const base = `https://api.github.com/repos/${repo}`
const folder = path.join(process.env.RUNNER_TEMP, 'release-refresh'), backup = path.join(folder, 'backup'), next = path.join(folder, 'next')
const names = [`PokeSleepAst-${version}.apk`, `PokeSleepAst-${version}-unsigned.ipa`, 'update.json']
const sha256 = data => createHash('sha256').update(data).digest('hex')
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
const expected = git(['rev-parse', 'HEAD'])
async function response(route, options = {}) {
  const url = route.startsWith('https://') ? route : base + route
  const result = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'PokeSleepAst-release-rebuild', ...options.headers }, signal: AbortSignal.timeout(180000) })
  if (!result.ok) throw Error(`GitHub ${options.method ?? 'GET'} returned ${result.status}: ${await result.text()}`)
  return result
}
async function api(route, options) { return (await response(route, options)).json() }
async function patch(id, values) { return api('/releases/' + id, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) }) }
async function verifyTag() {
  let object = (await api('/git/ref/tags/' + encodeURIComponent(tag))).object
  for (let i = 0; object.type === 'tag' && i < 5; i++) object = (await api('/git/tags/' + object.sha)).object
  if (object.type !== 'commit' || object.sha !== expected) throw Error('Tag moved while rebuilding; refusing to publish stale artifacts')
}
function verifyFiles() {
  const manifest = JSON.parse(fs.readFileSync(path.join(next, 'update.json'))), apk = fs.readFileSync(path.join(next, names[0]))
  if (manifest.version !== version || manifest.versionCode !== buildVersionCode(version) || manifest.fileName !== names[0] || manifest.size !== apk.length || manifest.sha256 !== sha256(apk)) throw Error('New APK and update manifest do not match')
  execFileSync('unzip', ['-tq', path.join(next, names[1])], { stdio: 'inherit' })
  return names.map(name => { const bytes = fs.readFileSync(path.join(next, name)); return { name, size: bytes.length, digest: 'sha256:' + sha256(bytes) } })
}
async function removeFiles(release) {
  for (const asset of release.assets.filter(asset => names.includes(asset.name))) await response('/releases/assets/' + asset.id, { method: 'DELETE' })
}
async function uploadFiles(id, source) {
  for (const name of names) {
    const bytes = fs.readFileSync(path.join(source, name))
    await api(`https://uploads.github.com/repos/${repo}/releases/${id}/assets?name=${encodeURIComponent(name)}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: bytes })
  }
}

if (process.argv[2] === 'prepare') {
  fs.mkdirSync(backup, { recursive: true }); fs.mkdirSync(next, { recursive: true })
  await verifyTag()
  const required = ['Android Release', 'iOS unsigned device build', 'WeChat miniapp']
  let ready
  for (let attempt = 0; attempt < 80; attempt++) {
    const runs = (await api(`/actions/runs?head_sha=${expected}&per_page=100`)).workflow_runs
    const builds = required.map(name => runs.find(run => run.name === name && run.head_sha === expected && run.head_branch === tag && run.event === 'push'))
    if (builds.some(run => run?.status === 'completed' && run.conclusion !== 'success')) throw Error('A required build failed; existing release was left unchanged')
    if (builds.every(run => run?.status === 'completed' && run.conclusion === 'success')) { ready = builds; break }
    console.log('Waiting for the Android, iOS, and WeChat builds at', expected)
    await new Promise(resolve => setTimeout(resolve, 15000))
  }
  if (!ready) throw Error('Timed out waiting for builds; existing release was left unchanged')
  for (const [index, artifactName] of [`android-${version}`, `ios-${version}-unsigned`].entries()) {
    const artifacts = (await api(`/actions/runs/${ready[index].id}/artifacts?per_page=100`)).artifacts
    const artifact = artifacts.find(item => item.name === artifactName && !item.expired)
    if (!artifact) throw Error('Missing verified build artifact: ' + artifactName)
    const zip = path.join(folder, artifactName + '.zip')
    fs.writeFileSync(zip, Buffer.from(await (await response(`/actions/artifacts/${artifact.id}/zip`)).arrayBuffer()))
    const entries = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean)
    if (entries.some(entry => entry.startsWith('/') || entry.split('/').includes('..'))) throw Error('Unsafe artifact ZIP path')
    execFileSync('unzip', ['-qo', zip, '-d', next], { stdio: 'inherit' })
  }
  const verified = verifyFiles()
  const previous = await api('/releases/tags/' + encodeURIComponent(tag))
  for (const name of names) {
    const asset = previous.assets.find(asset => asset.name === name)
    if (!asset) throw Error('Existing release is incomplete; refusing replacement without a full backup')
    const bytes = Buffer.from(await (await response(`/releases/assets/${asset.id}`, { headers: { Accept: 'application/octet-stream' } })).arrayBuffer())
    if (bytes.length !== asset.size || (asset.digest && asset.digest !== 'sha256:' + sha256(bytes))) throw Error('Backup digest mismatch: ' + name)
    fs.writeFileSync(path.join(backup, name), bytes)
  }
  fs.writeFileSync(path.join(backup, 'release.json'), JSON.stringify(previous, null, 2))
  fs.writeFileSync(path.join(folder, 'verified.json'), JSON.stringify({ expected, verified, builds: ready.map(run => run.id) }, null, 2))
  console.log('All builds and new attachments verified; the current release is backed up.')
} else if (process.argv[2] === 'publish') {
  const previous = JSON.parse(fs.readFileSync(path.join(backup, 'release.json')))
  const prepared = JSON.parse(fs.readFileSync(path.join(folder, 'verified.json')))
  if (prepared.expected !== expected) throw Error('Prepared artifacts belong to another commit')
  const verified = verifyFiles()
  if (JSON.stringify(verified) !== JSON.stringify(prepared.verified)) throw Error('Prepared files changed before publication')
  await verifyTag()
  const current = await api('/releases/tags/' + encodeURIComponent(tag))
  if (current.id !== previous.id || current.updated_at !== previous.updated_at) throw Error('Release changed after backup; refusing concurrent replacement')
  git(['fetch', '--no-tags', '--force', 'origin', `refs/tags/${tag}:refs/tags/${tag}`])
  if (git(['cat-file', '-t', 'refs/tags/' + tag]) !== 'tag') throw Error('Reviewed notes require an annotated tag')
  const notes = git(['for-each-ref', '--format=%(contents)', 'refs/tags/' + tag])
  if (!notes) throw Error('Reviewed release notes are empty')
  try {
    await patch(previous.id, { draft: true })
    await removeFiles(current)
    await uploadFiles(previous.id, next)
    const uploaded = await api('/releases/' + previous.id)
    for (const item of verified) if (!uploaded.assets.some(asset => asset.name === item.name && asset.size === item.size && asset.digest === item.digest)) throw Error('Uploaded asset verification failed: ' + item.name)
    await verifyTag()
    await patch(previous.id, { body: notes, draft: false, make_latest: 'true' })
    console.log('Published rebuilt release', tag, 'from', expected)
  } catch (error) {
    console.error('Replacement failed; restoring the previous verified release.')
    await removeFiles(await api('/releases/' + previous.id))
    await uploadFiles(previous.id, backup)
    await patch(previous.id, { body: previous.body, draft: previous.draft, make_latest: 'true' })
    throw error
  }
} else throw Error('Expected prepare or publish')
