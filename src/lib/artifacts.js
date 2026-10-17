import fs from 'node:fs/promises'
import path from 'node:path'
import { ensureDir } from './util.js'

export class Artifacts {
  constructor(config, runId) {
    this.config = config
    this.runId = runId
    this.dir = path.join(config.stateDir, 'artifacts', runId)
    this.logsDir = path.join(config.stateDir, 'logs')
    this.logFile = path.join(this.logsDir, `${runId}.jsonl`)
  }

  async init() {
    await ensureDir(this.dir)
    await ensureDir(this.logsDir)
  }

  path(name) {
    return path.join(this.dir, name)
  }

  async write(name, content) {
    const file = this.path(name)
    await ensureDir(path.dirname(file))
    await fs.writeFile(file, content, 'utf8')
    return file
  }

  async log(event) {
    await ensureDir(this.logsDir)
    const record = { at: new Date().toISOString(), ...event }
    await fs.appendFile(this.logFile, `${JSON.stringify(record)}\n`, 'utf8')
  }
}
