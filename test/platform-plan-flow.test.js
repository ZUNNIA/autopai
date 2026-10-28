import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'

test('the plan command discusses before it prepares', async () => {
  const text = await fs.readFile('platforms/opencode/commands/autopai-plan.md', 'utf8')
  assert.match(text, /never skips the discussion/)
  assert.match(text, /Do not run the CLI/)
  assert.match(text, /as many questions as the plan needs/)
  assert.match(text, /no fixed limit/)
  assert.match(text, /Run prepare only when the user explicitly asks/)
  assert.match(text, /Do not infer generation from a wish to implement/)
  assert.match(text, /retained brief and backlog session titles and ids/)
  assert.match(text, /autopai revise --repo \. --message/)
  assert.match(text, /do not tell the user to paste/i)
  assert.match(text, /do not run prepare again/i)
  assert.match(text, /loading a (core )?prompt from `src\/prompts`/)
  assert.match(text, /plannerMessages/)
  assert.doesNotMatch(text, /Run AutopAI in prepare mode\./)
  assert.match(text, /Never approve the backlog/)
})

test('the operator routes feature ideas to discussion, not prepare', async () => {
  const text = await fs.readFile('platforms/opencode/agents/autopai.md', 'utf8')
  assert.match(text, /A feature idea or a discussion request is not approval/)
  assert.match(text, /Discuss and write nothing/)
  assert.match(text, /as many questions as the discussion needs/)
  assert.match(text, /no fixed limit/)
  assert.match(text, /## Feature discussions/)
  assert.match(text, /retained brief and backlog session titles and ids/)
  assert.match(text, /autopai revise --repo \. --message/)
  assert.match(text, /do not tell the user to paste/i)
  assert.match(text, /do not run prepare again/i)
  assert.match(text, /loading a (core )?prompt from `src\/prompts`/)
  assert.match(text, /plannerMessages/)
  assert.match(text, /deletes the retained prepare sessions only after a successful backlog approval/)
  assert.doesNotMatch(text, /Nothing, or a reference to this conversation/)
})

test('retained planner sessions edit artifacts without a prompt reload', async () => {
  const planner = await fs.readFile('platforms/opencode/agents/planner.md', 'utf8')
  const brief = await fs.readFile('src/prompts/feature-brief.md', 'utf8')
  const backlog = await fs.readFile('src/prompts/backlog.md', 'utf8')
  assert.match(planner, /follow-up review message/)
  assert.match(planner, /edit the existing files in place/)
  assert.match(brief, /## Review/)
  assert.match(backlog, /update the existing brief and backlog in place/)
  assert.match(backlog, /Do not restart from this prompt/)
  assert.match(planner, /state the question in your final message/)
})

test('the operator routes by intent, not by a literal phrase', async () => {
  const text = await fs.readFile('platforms/opencode/agents/autopai.md', 'utf8')
  assert.match(text, /Decide from the intent and the conversation, never from a fixed phrase/)
  assert.match(text, /A statement of intent to implement a feature is a goal, not an instruction to run a phase/)
  assert.match(text, /Only then run `prepare`/)
  assert.match(text, /Never run a phase by default/)
})

test('the revise path continues the existing session without loading a prompt', async () => {
  const cli = await fs.readFile('src/cli.js', 'utf8')
  const session = await fs.readFile('src/lib/session.js', 'utf8')
  const runner = await fs.readFile('src/runners/opencode.js', 'utf8')
  assert.match(cli, /continueSession/)
  assert.match(session, /continueSession/)
  assert.match(runner, /export async function continueSession/)
  assert.doesNotMatch(cli, /loadPrompt/)
  assert.doesNotMatch(runner, /loadPrompt/)
})

test('prompts and docs do not contain Spanish trigger examples', async () => {
  const paths = [
    'README.md',
    'platforms/opencode/agents/autopai.md',
    'platforms/opencode/commands/autopai-plan.md',
    'platforms/opencode/commands/autopai-identify.md',
    'platforms/opencode/commands/autopai-refactor.md',
    'platforms/opencode/commands/autopai-resume.md',
    'platforms/opencode/agents/planner.md',
    'platforms/opencode/commands/ux-review.md',
    'src/prompts/feature-brief.md',
    'src/prompts/backlog.md'
  ]
  const texts = await Promise.all(paths.map(file => fs.readFile(file, 'utf8')))
  const combined = texts.join('\n')
  assert.doesNotMatch(combined, /quiero implementar|discutamos esta feature|genera el brief|arregla los fallos|solo code smell|solo missing|solo tickets|de lo que discutimos|con prioridad|de importancia/i)
  assert.doesNotMatch(combined, /[áéíóúñ¿¡ÁÉÍÓÚÑ]/)
  assert.match(combined, /any language/)
})

test('operational commands do not cap clarifying questions', async () => {
  const agent = await fs.readFile('platforms/opencode/agents/autopai.md', 'utf8')
  const init = await fs.readFile('platforms/opencode/commands/autopai-init.md', 'utf8')
  assert.doesNotMatch(agent, /at most one|one confirmation|ask one question/)
  assert.doesNotMatch(init, /one confirmation|ask one question/)
  assert.match(agent, /there is no fixed limit, for operational commands and feature discussions/)
})

test('approval and ADR commands require a status preflight', async () => {
  const agent = await fs.readFile('platforms/opencode/agents/autopai.md', 'utf8')
  const resume = await fs.readFile('platforms/opencode/commands/autopai-resume.md', 'utf8')
  const adr = await fs.readFile('platforms/opencode/commands/autopai-adr.md', 'utf8')
  assert.match(agent, /Before any `--approve`, run `autopai status/)
  assert.match(agent, /gate` is null/)
  assert.match(agent, /failures or blockers/)
  assert.match(resume, /Before composing the command, run `autopai status/)
  assert.match(resume, /failed ticket or a blocker is not a human gate/)
  assert.match(adr, /Run `autopai status/)
  assert.match(adr, /Do not approve a gate/)
  assert.match(adr, /never pass `--approve plan`/)
})

test('the readme documents the two-stage plan flow', async () => {
  const text = await fs.readFile('README.md', 'utf8')
  assert.match(text, /Nothing is written yet/)
  assert.match(text, /only generates after your explicit confirmation/)
  assert.match(text, /Generate the brief and backlog/)
})
