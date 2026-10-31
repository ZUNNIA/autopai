import test from 'node:test'
import assert from 'node:assert/strict'
import { checkRunIdFromLink, classifyCheckAnnotations, formatCheckAnnotations } from '../src/lib/ci-failure.js'
import { collectFailureLogs } from '../src/lib/pr.js'

test('classifies GitHub Actions billing annotations before generic infrastructure', () => {
  const classification = classifyCheckAnnotations([
    { annotation_level: 'failure', message: 'The job was not started because recent account payments have failed or your spending limit needs to be increased.' },
    { annotation_level: 'notice', message: 'The ubuntu-latest label will migrate to Ubuntu 26.' }
  ])
  assert.equal(classification.kind, 'billing')
  assert.match(classification.message, /recent account payments have failed/)
})

test('classifies runner and permission annotations as infrastructure', () => {
  assert.equal(classifyCheckAnnotations([{ message: 'No runner is available for this job.' }]).kind, 'infrastructure')
  assert.equal(classifyCheckAnnotations([{ message: 'Resource not accessible by integration.' }]).kind, 'infrastructure')
})

test('leaves code annotations unknown and formats every message', () => {
  const annotation = { annotation_level: 'failure', message: 'Process completed with exit code 1.' }
  assert.equal(classifyCheckAnnotations([annotation]).kind, 'unknown')
  assert.equal(formatCheckAnnotations([annotation]), 'failure: Process completed with exit code 1.')
})

test('extracts the check run id from a job link', () => {
  assert.equal(checkRunIdFromLink('https://github.com/acme/repo/actions/runs/41137926945/job/124585045796'), '124585045796')
  assert.equal(checkRunIdFromLink('https://github.com/acme/repo/pull/1'), null)
})

test('collects billing annotations as infrastructure without a usable log', async () => {
  const writes = new Map()
  const artifacts = {
    write: async (name, text) => { writes.set(name, text) }
  }
  const annotation = {
    annotation_level: 'failure',
    message: 'The job was not started because recent account payments have failed or your spending limit needs to be increased.'
  }
  const failure = await collectFailureLogs({
    config: { repoPath: '.' },
    artifacts,
    attempt: 1,
    checks: [{
      name: 'Python backend tests',
      state: 'FAILURE',
      link: 'https://github.com/ZUNNIA/Ada-Asistente/actions/runs/41137926945/job/124585045796'
    }],
    githubClient: {
      runFailedLog: async () => ({ ok: false, text: 'log not found: 124585045796' }),
      checkAnnotations: async () => ({ ok: true, annotations: [annotation] })
    }
  })

  assert.equal(failure.usable, false)
  assert.equal(failure.infrastructure.length, 1)
  assert.equal(failure.infrastructure[0].classification.kind, 'billing')
  assert.match(failure.text, /Annotations:/)
  assert.match(failure.text, /recent account payments have failed/)
  assert.match(writes.get('ci-failure-1.log'), /Python backend tests/)
})

test('keeps code failures without annotations out of the infrastructure path', async () => {
  const artifacts = { write: async () => {} }
  const failure = await collectFailureLogs({
    config: { repoPath: '.' },
    artifacts,
    attempt: 2,
    checks: [{ name: 'Build and test', state: 'FAILURE', link: 'https://github.com/acme/repo/actions/runs/1/job/2' }],
    githubClient: {
      runFailedLog: async () => ({ ok: false, text: 'log not found: 2' }),
      checkAnnotations: async () => ({ ok: false, annotations: [], reason: 'not found' })
    }
  })

  assert.deepEqual(failure.infrastructure, [])
  assert.equal(failure.annotations[0].classification.kind, 'unknown')
})
