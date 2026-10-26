import test from 'node:test'
import assert from 'node:assert/strict'
import {
  describeFilters,
  filterTickets,
  matchesFilters,
  normalizeClassification,
  normalizeClassificationList,
  normalizeFilters,
  normalizePriorityList,
  parseClassification,
  parsePriority
} from '../src/lib/filters.js'

test('normalizes classifications and priorities', () => {
  assert.equal(normalizeClassification('Code Smell'), 'code-smell')
  assert.equal(normalizeClassification('code_smell'), 'code-smell')
  assert.equal(normalizeClassification('falta de cobertura'), 'lack-of-coverage')
  assert.equal(normalizeClassification('documentación'), 'missing-documentation')
  assert.equal(normalizeClassification('arquitectura'), 'architecture')
  assert.equal(normalizeClassification('unknown'), null)
  assert.deepEqual(normalizeClassificationList('code smell, architecture'), ['code-smell', 'architecture'])
  assert.deepEqual(normalizePriorityList('urgente,Important'), ['urgent', 'important'])
  assert.throws(() => normalizeClassificationList('unknown'), /Unknown classification: unknown/)
  assert.throws(() => normalizePriorityList(true), /priority filter needs a value/)
})

test('reads the checked classification and priority from the debt body', () => {
  const body = [
    '## 0. Classification',
    '',
    '* [x] **Code Smell:** duplicated logic.',
    '* [ ] **Architecture**',
    '* [ ] **Lack of Coverage**',
    '',
    'Priority:',
    '',
    '* [ ] **Urgent**',
    '* [x] **Important:** it costs time.',
    '* [ ] **Minor**'
  ].join('\n')
  assert.equal(parseClassification(body), 'code-smell')
  assert.equal(parsePriority(body), 'important')
})

test('supports the real audit body format with emoji and colons', () => {
  const body = [
    '* [x] \u{1f9e9} **Code Smell:** one record.',
    '* [ ] \u{1f3d7}\ufe0f **Architecture**',
    '* [x] \u{1f7e1} **Important:** it costs time.'
  ].join('\n')
  assert.equal(parseClassification(body), 'code-smell')
  assert.equal(parsePriority(body), 'important')
})

test('combines filters with AND and lists with OR', () => {
  const filters = normalizeFilters({ classification: 'code-smell,architecture', priority: 'urgent,important' })
  assert.equal(matchesFilters({ classification: 'code-smell', priority: 'urgent' }, filters), true)
  assert.equal(matchesFilters({ classification: 'architecture', priority: 'important' }, filters), true)
  assert.equal(matchesFilters({ classification: 'code-smell', priority: 'minor' }, filters), false)
  assert.equal(matchesFilters({ classification: 'lack-of-coverage', priority: 'urgent' }, filters), false)
  assert.equal(matchesFilters({ classification: null, priority: 'urgent' }, filters), false)
})

test('returns every ticket when no filter is active', () => {
  const tickets = [{ classification: null, priority: 'minor' }, { classification: 'architecture', priority: 'urgent' }]
  assert.deepEqual(filterTickets(tickets, normalizeFilters({})), tickets)
  assert.deepEqual(filterTickets(null, normalizeFilters({})), [])
  assert.deepEqual(filterTickets(tickets, normalizeFilters({ priority: 'urgent' })), [tickets[1]])
  assert.equal(describeFilters(normalizeFilters({ classification: 'code-smell', priority: 'urgent' })), 'classification=code-smell, priority=urgent')
})
