import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { customerTaskBrief, customerTasks, customerTasksAnchor, customerTasksSection } from '../content/customer-tasks'

test('task choices are four bounded prompts, not calculators, medical promises or hidden psychotypes', () => {
  const section = customerTasksSection()
  assert.equal(section.anchor, customerTasksAnchor); assert.equal(section.kind, 'details')
  assert.equal(section.cards?.length, 4)
  for (const task of customerTasks) {
    const brief = customerTaskBrief(task.title, task.body)
    assert.ok(brief.length <= 500 && brief.length >= 10)
    assert.ok(brief.includes(task.title))
    assert.doesNotMatch(task.body, /100%|99%|15.?16|гарантир|бесплат|мгновен/i)
  }
  assert.equal(customerTaskBrief('x'.repeat(1000)).length, 500)
  assert.ok(!section.cards?.some(card => card.image))
})
test('task content can be inspected offline without initializing services', () => {
  const data = JSON.parse(execFileSync(process.execPath, ['--import', 'tsx', 'scripts/content-tasks.ts', '--list'], { encoding: 'utf8', timeout: 30000, env: { ...process.env, AFARA_STAGE: '', DATABASE_URL: '' } }))
  assert.equal(data.anchor, customerTasksAnchor); assert.equal(data.cards.length, 4)
})
