import assert from "node:assert/strict";
import test from "node:test";
import { analyzeContent, type BrandRule } from "./rules-engine.ts";

const rules: BrandRule[] = [
  {
    id: "spelling",
    category: "terminology",
    name: "Approved spelling",
    description: "Write Inkloom AI with a space.",
    pattern: "InkloomAI",
    replacement: "Inkloom AI",
    severity: "medium",
    enabled: true,
    sample: true,
  },
  {
    id: "claim",
    category: "prohibited_claim",
    name: "Substantiate claims",
    description: "Absolute claims need an approved source.",
    pattern: "guaranteed|100% accurate",
    replacement: "Provide approved source evidence.",
    severity: "high",
    enabled: true,
    sample: true,
  },
  {
    id: "disclaimer",
    category: "disclaimer",
    name: "Performance disclaimer",
    description: "Add the sample disclaimer when making claims.",
    pattern: "results may vary",
    replacement: "Add “Results may vary.”",
    severity: "medium",
    enabled: true,
    sample: true,
  },
  {
    id: "link-label",
    category: "accessibility",
    name: "Descriptive links",
    description: "Avoid generic link text.",
    pattern: "click here",
    replacement: "Use a descriptive link label.",
    severity: "low",
    enabled: true,
    sample: true,
  },
];

test("flags the exact original terminology and provides the configured correction", () => {
  const findings = analyzeContent("Try InkloomAI today.", rules);
  const spelling = findings.find((finding) => finding.type === "Terminology");
  assert.equal(spelling?.evidence, "InkloomAI");
  assert.equal(spelling?.suggestion, "Inkloom AI");
  assert.equal(spelling?.status, "open");
});

test("claims remain unverified and a missing configured disclaimer is flagged", () => {
  const findings = analyzeContent("Guaranteed 100% accurate outcomes.", rules);
  const claims = findings.filter((finding) => finding.type === "Factual claim");
  assert.equal(claims.length, 2);
  assert.ok(claims.every((finding) => finding.severity === "high"));
  assert.ok(claims.every((finding) => finding.explanation.includes("not been verified")));
  assert.ok(findings.some((finding) => finding.type === "Required disclaimer"));
});

test("a present disclaimer suppresses only the missing-disclaimer finding", () => {
  const findings = analyzeContent(
    "Guaranteed outcomes. Results may vary.",
    rules,
  );
  assert.equal(
    findings.filter((finding) => finding.type === "Required disclaimer").length,
    0,
  );
  assert.equal(findings.filter((finding) => finding.type === "Factual claim").length, 1);
});

test("flags generic link labels and long all-caps text", () => {
  const findings = analyzeContent("Click here to continue. GRAB YOURS NOW!", rules);
  assert.ok(findings.some((finding) => finding.type === "Accessibility" && finding.evidence === "Click here"));
  assert.ok(findings.some((finding) => finding.type === "Accessibility" && finding.evidence === "GRAB YOURS NOW"));
});

test("clean copy produces no findings", () => {
  assert.deepEqual(analyzeContent("Inkloom AI helps teams review their copy.", rules), []);
});
