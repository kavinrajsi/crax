import test from "node:test"
import assert from "node:assert/strict"

import {
  DEAL_STAGES,
  DEAL_STAGE_KEYS,
  CLOSED_STAGES,
  stageMeta,
  isOpenStage,
  pipelineValue,
  formatMoney,
} from "../src/lib/deal-stages.js"

/**
 * The stage keys must match the CHECK constraint in
 * db/migrations/002-create-deals.sql. That agreement is enforced against the
 * live database by scripts/check-constraints.mjs; these tests cover the parts
 * that need no connection.
 */

test("DEAL_STAGE_KEYS mirrors DEAL_STAGES, in order", () => {
  assert.deepEqual(DEAL_STAGE_KEYS, DEAL_STAGES.map((s) => s.key))
  assert.deepEqual(DEAL_STAGE_KEYS, [
    "qualification", "proposal", "negotiation", "won", "lost",
  ])
})

test("every stage carries the metadata the board renders", () => {
  for (const stage of DEAL_STAGES) {
    assert.equal(typeof stage.label, "string")
    assert.match(stage.color, /^#[0-9a-f]{6}$/i, `${stage.key} needs a hex colour`)
    assert.ok(
      stage.probability >= 0 && stage.probability <= 100,
      `${stage.key} probability out of range`
    )
  }
})

test("CLOSED_STAGES are real stage keys", () => {
  for (const key of CLOSED_STAGES) {
    assert.ok(DEAL_STAGE_KEYS.includes(key), `${key} is not a stage`)
  }
})

test("stageMeta: known key, and a documented fallback for an unknown one", () => {
  assert.equal(stageMeta("won").label, "Won")
  // Unknown keys fall back to the first stage rather than returning undefined,
  // so the board renders something instead of throwing on bad data.
  assert.equal(stageMeta("nonsense").key, "qualification")
  assert.equal(stageMeta(undefined).key, "qualification")
})

test("isOpenStage: won and lost are closed, the rest are open", () => {
  assert.equal(isOpenStage("won"), false)
  assert.equal(isOpenStage("lost"), false)
  assert.equal(isOpenStage("qualification"), true)
  assert.equal(isOpenStage("proposal"), true)
  assert.equal(isOpenStage("negotiation"), true)
})

test("pipelineValue: closed deals are excluded", () => {
  // The red state here is dropping the isOpenStage filter. Both closed deals
  // carry a large non-zero value, so an unfiltered sum would be 1_650 and this
  // assertion would fail rather than coincidentally agree.
  const deals = [
    { stage: "qualification", value: 100 },
    { stage: "proposal", value: 250 },
    { stage: "negotiation", value: 300 },
    { stage: "won", value: 900 },
    { stage: "lost", value: 100 },
  ]
  assert.equal(pipelineValue(deals), 650)
})

test("pipelineValue: tolerates the shapes the driver actually returns", () => {
  // numeric(12,2) comes back as a string from @neondatabase/serverless.
  assert.equal(pipelineValue([{ stage: "proposal", value: "150.00" }]), 150)
  assert.equal(pipelineValue([{ stage: "proposal", value: null }]), 0)
  assert.equal(pipelineValue([{ stage: "proposal" }]), 0)
  assert.equal(pipelineValue([]), 0)
})

test("formatMoney: rupees, no fractional part", () => {
  const formatted = formatMoney(1234567)
  assert.ok(formatted.includes("₹"), `expected a rupee symbol: ${formatted}`)
  assert.ok(!formatted.includes("."), `expected no decimals: ${formatted}`)
  assert.equal(formatMoney(null), formatMoney(0))
  assert.equal(formatMoney(undefined), formatMoney(0))
  assert.equal(formatMoney("250"), formatMoney(250))
})
