import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { applySleepDpr, referenceDpr, sleepDprKey } from './sleep-dpr-data.mjs'
const read = name => JSON.parse(fs.readFileSync(new URL(`../../core/src/data/${name}.json`, import.meta.url)))
const snapshot = read('sleep-dpr-source'), rows = read('sleep-styles')
test('RAE 100 means 1.0x: regular Suicune DPR is not multiplied by 100', () => {
  assert.equal(referenceDpr({ regular: { reference: 7242, isSettled: true } }, 1).dpr, 275196000)
  assert.equal(snapshot.raeUiMultiplier / 100, snapshot.normalizedMultiplier)
})
test('an independent EX2 reference wins even when its settled flag is false', () => {
  const result = referenceDpr({ ex: { 10001: { reference: 3932 }, 10002: { reference: 4070, isSettled: false } } }, 10002)
  assert.equal(result.dpr, 154660000)
  assert.equal(result.estimated, false)
  assert.equal(result.settled, false)
})
test('EX2 missing data uses EX1 times exactly 1.0351 and rounds only the final DPR', () => {
  const result = referenceDpr({ ex: { 10001: { reference: 16676 } } }, 10002)
  assert.equal(result.dpr, 655930449)
  assert.equal(result.estimated, true)
  assert.equal(result.settled, false)
  assert.equal(referenceDpr({}, 10002), undefined)
  assert.equal(referenceDpr({ regular: { reference: 7242 } }, 10002), undefined)
})
test('all ordinary styles are covered and match the offline source snapshot', () => {
  assert.equal(new Set(snapshot.entries.map(e => e.key)).size, snapshot.entries.length)
  assert.equal(snapshot.entries.length, rows.filter(r => !r.limited).length)
  const source = new Map(snapshot.entries.map(e => [e.key, e]))
  for (const row of rows.filter(r => !r.limited)) {
    const entry = source.get(sleepDprKey(row))
    assert.equal(row.dpr, entry.dpr)
    assert.equal(row.dprEstimated, entry.estimated)
    assert.ok(Number.isSafeInteger(row.dpr) && row.dpr > 0)
  }
})
test('exactly five approved ordinary styles retain explicitly unverified legacy estimates', () => {
  const missing = snapshot.entries.filter(e => !e.sourceMapId)
  assert.equal(missing.length, 5)
  assert.ok(missing.every(e => e.estimated && !e.settled && e.source.includes('未核验')))
})
test('extracting data again preserves corrected DPR and the original sleep identities', () => {
  const old = rows.map(row => ({ ...row, dpr: 1 }))
  const corrected = applySleepDpr(old, snapshot)
  corrected.forEach((row, index) => {
    assert.equal(row.id, rows[index].id)
    assert.equal(row.styleId, rows[index].styleId)
    assert.equal(row.dpr, row.limited ? 1 : rows[index].dpr)
  })
  assert.throws(() => applySleepDpr([{ island: 'cyanex', pokeId: -1, stars: 1 }], snapshot), /Missing DPR/)
})
