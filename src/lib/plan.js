import fs from 'node:fs/promises'
import path from 'node:path'
import { ensureDir, atomicWriteJson, readJson, slugify } from './util.js'

const PROPOSAL_FILE = 'plan-proposal.json'

export function planProposalPath(config) {
  return path.join(config.stateDir, PROPOSAL_FILE)
}

export async function writePlanProposal({ config, feature, description }) {
  const slug = slugify(String(feature ?? ''))
  const summary = String(description ?? '').trim()
  if (!slug) throw new Error('A feature slug is required for the plan proposal.')
  if (!summary) throw new Error('A description is required for the plan proposal.')

  await ensureDir(config.stateDir)
  const file = planProposalPath(config)
  await atomicWriteJson(file, {
    version: 1,
    feature: slug,
    description: summary,
    createdAt: new Date().toISOString()
  })
  return { file, feature: slug, description: summary }
}

export async function readPlanProposal(config) {
  const proposal = await readJson(planProposalPath(config))
  if (!proposal) return null
  if (proposal.version !== 1 || typeof proposal.feature !== 'string' || typeof proposal.description !== 'string') {
    throw new Error(`Invalid plan proposal at ${planProposalPath(config)}. Run plan propose again.`)
  }
  return proposal
}

export async function clearPlanProposal(config) {
  await fs.rm(planProposalPath(config), { force: true })
}
