export type FindingSeverity = "high" | "medium" | "low" | "info";
export type RuleCategory =
  | "tone"
  | "terminology"
  | "prohibited_claim"
  | "approved_messaging"
  | "disclaimer"
  | "accessibility"
  | "visual";

export interface BrandRule {
  id: string;
  category: RuleCategory;
  name: string;
  description: string;
  pattern: string;
  replacement: string | null;
  severity: FindingSeverity;
  enabled: boolean;
  sample: boolean;
}

export interface Finding {
  id: string;
  type: string;
  severity: FindingSeverity;
  evidence: string;
  explanation: string;
  rule: string;
  suggestion: string;
  status: "open" | "accepted" | "dismissed";
}

function phrases(pattern: string): string[] {
  return pattern
    .split("|")
    .map((phrase) => phrase.trim())
    .filter((phrase) => phrase.length > 0);
}

function findEvidence(content: string, phrase: string): string | null {
  const start = content.toLocaleLowerCase().indexOf(phrase.toLocaleLowerCase());
  return start < 0 ? null : content.slice(start, start + phrase.length);
}

function issueType(category: RuleCategory): string {
  switch (category) {
    case "tone":
      return "Tone consistency";
    case "terminology":
      return "Terminology";
    case "prohibited_claim":
      return "Factual claim";
    case "approved_messaging":
      return "Approved messaging";
    case "disclaimer":
      return "Required disclaimer";
    case "accessibility":
      return "Accessibility";
    case "visual":
      return "Visual consistency";
  }
}

function buildFinding(
  rule: BrandRule,
  evidence: string,
  suggestion: string,
  explanation: string,
): Finding {
  return {
    id: crypto.randomUUID(),
    type: issueType(rule.category),
    severity: rule.severity,
    evidence,
    explanation,
    rule: `${rule.name} — ${rule.description}`,
    suggestion,
    status: "open",
  };
}

export function analyzeContent(content: string, rules: BrandRule[]): Finding[] {
  const findings: Finding[] = [];
  const claimFindings: Finding[] = [];
  const enabledRules = rules.filter((rule) => rule.enabled);

  for (const rule of enabledRules) {
    if (rule.category === "disclaimer" || rule.category === "visual") continue;

    for (const phrase of phrases(rule.pattern)) {
      const evidence = findEvidence(content, phrase);
      if (!evidence) continue;

      const isClaim = rule.category === "prohibited_claim";
      const explanation = isClaim
        ? `The text contains “${evidence}”. No approved-source repository is connected, so this claim has not been verified and needs human evidence review.`
        : `The text contains “${evidence}”, which matches this configured sample brand rule.`;
      const suggestion =
        rule.replacement ??
        (isClaim
          ? "Add an approved source for human verification, or revise to a measurable, supportable statement."
          : "Revise this phrase to follow the applicable brand rule.");
      const finding = buildFinding(rule, evidence, suggestion, explanation);
      findings.push(finding);
      if (isClaim) claimFindings.push(finding);
    }
  }

  if (claimFindings.length > 0) {
    for (const rule of enabledRules.filter(
      (candidate) => candidate.category === "disclaimer",
    )) {
      const hasDisclaimer = phrases(rule.pattern).some(
        (phrase) => findEvidence(content, phrase) !== null,
      );
      if (hasDisclaimer) continue;

      findings.push(
        buildFinding(
          rule,
          claimFindings[0].evidence,
          rule.replacement ?? "Add the required approved disclaimer.",
          `A performance or absolute claim was detected, but the configured disclaimer “${phrases(rule.pattern)[0]}” was not found. The claim remains unverified and requires human review.`,
        ),
      );
    }
  }

  const allCapsPhrase = content.match(
    /(?:^|[^\p{L}\p{N}])([\p{Lu}\p{N}]{3,}(?:\s+[\p{Lu}\p{N}]{3,})+)(?=$|[^\p{L}\p{N}])/u,
  )?.[1];
  if (allCapsPhrase) {
    findings.push({
      id: crypto.randomUUID(),
      type: "Accessibility",
      severity: "low",
      evidence: allCapsPhrase,
      explanation:
        "Extended all-caps text can be harder to read. This text-only check cannot assess the rendered design or assistive-technology output.",
      rule: "Sample accessibility check — avoid long all-caps phrases.",
      suggestion: "Use sentence case unless capitalization is required by the brand.",
      status: "open",
    });
  }

  if (content.length > 1200 && content.split(/\n\s*\n/).length < 2) {
    const evidence = content.slice(0, 180);
    findings.push({
      id: crypto.randomUUID(),
      type: "Accessibility",
      severity: "info",
      evidence,
      explanation:
        "This single text block is long. Text-only checks cannot determine the final layout, heading structure, contrast, image alternatives, or keyboard behavior.",
      rule: "Sample accessibility check — break long copy into readable sections.",
      suggestion:
        "Consider adding descriptive headings and shorter paragraphs in the publishing layout.",
      status: "open",
    });
  }

  return findings;
}
