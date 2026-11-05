import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {
  continueSession,
  deleteSession,
  expandCommand,
  listSessions,
  runSession,
  validateCommandRunnerOptions
} from '../src/runners/command.js'

async function repo() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'autopai-command-runner-'))
}

function config(repoPath, runnerOptions) {
  return {
    repoPath,
    sessionTimeoutMinutes: 1,
    models: {},
    runnerOptions
  }
}

const stdinScript = 'let data = ""; process.stdin.on("data", chunk => { data += chunk }); process.stdin.on("end", () => process.stdout.write(data))'
const readFileScript = 'process.stdout.write(require("node:fs").readFileSync(process.argv[1], "utf8"))'
const argumentScript = 'process.stdout.write(process.argv[1])'

test('runs a command with the prompt on stdin', async () => {
  const dir = await repo()
  const result = await runSession({
    config: config(dir, { run: [process.execPath, '-e', stdinScript] }),
    agent: 'executor',
    role: 'executor',
    promptText: 'hello from stdin',
    title: 'stdin test',
    logFile: path.join(dir, 'stdin.log')
  })
  assert.equal(result.code, 0)
  assert.equal(result.stdout, 'hello from stdin')
  assert.equal(await fs.readFile(path.join(dir, 'stdin.prompt.md'), 'utf8'), 'hello from stdin')
  assert.match(await fs.readFile(path.join(dir, 'stdin.log'), 'utf8'), /hello from stdin/)
})

test('runs a command with the prompt in a file', async () => {
  const dir = await repo()
  const result = await runSession({
    config: config(dir, {
      prompt: 'file',
      run: [process.execPath, '-e', readFileScript, '{promptFile}']
    }),
    agent: 'executor',
    role: 'executor',
    promptText: 'hello from file',
    title: 'file test',
    logFile: path.join(dir, 'file.log')
  })
  assert.equal(result.stdout, 'hello from file')
})

test('runs a command with the prompt as an argument', async () => {
  const dir = await repo()
  const result = await runSession({
    config: config(dir, {
      prompt: 'argument',
      run: [process.execPath, '-e', argumentScript, '{prompt}']
    }),
    agent: 'executor',
    role: 'executor',
    promptText: 'hello from argument',
    title: 'argument test',
    logFile: path.join(dir, 'argument.log')
  })
  assert.equal(result.stdout, 'hello from argument')
})

test('drops an empty optional model flag and its value', () => {
  assert.deepEqual(expandCommand(['tool', '--model', '{model}'], { model: '' }), ['tool'])
  assert.deepEqual(expandCommand(['tool', '--model', '{model}'], { model: 'provider/model' }), ['tool', '--model', 'provider/model'])
})

test('lists and deletes sessions through configured commands', async () => {
  const dir = await repo()
  const list = [
    process.execPath,
    '-e',
    'process.stdout.write(JSON.stringify([{ id: "s1", title: "task", directory: process.cwd(), created: 1 }]))'
  ]
  const remove = [
    process.execPath,
    '-e',
    'require("node:fs").appendFileSync("deleted.txt", process.argv[1])',
    '{sessionId}'
  ]
  const runnerConfig = config(dir, { run: [process.execPath, '-e', stdinScript], list, delete: remove })
  const sessions = await listSessions({ config: runnerConfig })
  assert.deepEqual(sessions.map(session => session.id), ['s1'])
  const deleted = await deleteSession({ config: runnerConfig, session: { id: 's1' } })
  assert.equal(deleted.deleted, true)
  assert.equal(await fs.readFile(path.join(dir, 'deleted.txt'), 'utf8'), 's1')
})

test('continues a session through the configured command', async () => {
  const dir = await repo()
  const runnerConfig = config(dir, {
    continue: [process.execPath, '-e', stdinScript, '{sessionId}']
  })
  const result = await continueSession({
    config: runnerConfig,
    session: { id: 's1' },
    message: 'review this',
    agent: 'planner',
    logFile: path.join(dir, 'continue.log')
  })
  assert.equal(result.sessionId, 's1')
  assert.equal(result.stdout, 'review this')
})

test('validates command runner options', () => {
  assert.throws(
    () => validateCommandRunnerOptions({ run: [] }),
    /non-empty array/
  )
  assert.throws(
    () => validateCommandRunnerOptions({ run: ['tool'], prompt: 'network' }),
    /prompt must be one of/
  )
  assert.throws(
    () => validateCommandRunnerOptions({ run: ['tool', '{unknown}'] }),
    /unknown placeholder/
  )
  assert.throws(
    () => validateCommandRunnerOptions({ run: ['tool'], prompt: 'file' }),
    /must include \{promptFile\}/
  )
})
