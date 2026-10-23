import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { BrandRule, Finding, FindingSeverity, RuleCategory } from "./rules-engine";

export type ReviewStatus = "Pending" | "Approved" | "Needs Changes" | "Dismissed";

export interface ReviewAuditEvent {
  id: string;
  action: string;
  actor: string;
  reason: string | null;
  at: string;
}

export interface Review {
  id: string;
  title: string;
  channel: string;
  content: string;
  status: ReviewStatus;
  findings: Finding[];
  auditLog: ReviewAuditEvent[];
  reviewer: string | null;
  decisionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewInput {
  title: string;
  channel: string;
  content: string;
}

export interface RuleInput {
  category: RuleCategory;
  name: string;
  description: string;
  pattern: string;
  replacement?: string | null;
  severity: FindingSeverity;
  enabled: boolean;
}

type DbRow = Record<string, string | number | null>;

function getDatabasePath(): string {
  const configured = process.env.INKLOOM_DB_PATH;
  const pathFromPackage = path.resolve(process.cwd(), "data/inkloom.sqlite");
  const pathFromWorkspace = path.resolve(
    process.cwd(),
    "artifacts/api-server/data/inkloom.sqlite",
  );
  const selected = configured
    ? path.resolve(configured)
    : existsSync(path.resolve(process.cwd(), "config/inkloom-rules.json"))
      ? pathFromPackage
      : pathFromWorkspace;
  mkdirSync(path.dirname(selected), { recursive: true });
  return selected;
}

const database = new DatabaseSync(getDatabasePath());
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS inkloom_rules (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    pattern TEXT NOT NULL,
    replacement TEXT,
    severity TEXT NOT NULL,
    enabled INTEGER NOT NULL,
    sample INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS inkloom_reviews (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    channel TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    findings_json TEXT NOT NULL,
    reviewer TEXT,
    decision_reason TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS inkloom_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id TEXT NOT NULL REFERENCES inkloom_reviews(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    actor TEXT NOT NULL,
    reason TEXT,
    at TEXT NOT NULL
  );
`);

function mapRule(row: DbRow): BrandRule {
  return {
    id: String(row.id),
    category: String(row.category) as RuleCategory,
    name: String(row.name),
    description: String(row.description),
    pattern: String(row.pattern),
    replacement: row.replacement == null ? null : String(row.replacement),
    severity: String(row.severity) as FindingSeverity,
    enabled: Number(row.enabled) === 1,
    sample: Number(row.sample) === 1,
  };
}

function mapReview(row: DbRow): Review {
  const auditRows = database
    .prepare(
      "SELECT id, action, actor, reason, at FROM inkloom_audit WHERE review_id = ? ORDER BY id ASC",
    )
    .all(String(row.id)) as DbRow[];
  return {
    id: String(row.id),
    title: String(row.title),
    channel: String(row.channel),
    content: String(row.content),
    status: String(row.status) as ReviewStatus,
    findings: JSON.parse(String(row.findings_json)) as Finding[],
    auditLog: auditRows.map((event) => ({
      id: String(event.id),
      action: String(event.action),
      actor: String(event.actor),
      reason: event.reason == null ? null : String(event.reason),
      at: String(event.at),
    })),
    reviewer: row.reviewer == null ? null : String(row.reviewer),
    decisionReason:
      row.decision_reason == null ? null : String(row.decision_reason),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function seedConfiguredRules(): void {
  const existing = database
    .prepare("SELECT COUNT(*) AS count FROM inkloom_rules")
    .get() as DbRow | undefined;
  if (Number(existing?.count ?? 0) > 0) return;

  const configCandidates = [
    path.resolve(process.cwd(), "config/inkloom-rules.json"),
    path.resolve(process.cwd(), "artifacts/api-server/config/inkloom-rules.json"),
  ];
  const configPath = configCandidates.find((candidate) => existsSync(candidate));
  if (!configPath) {
    throw new Error(
      "Inkloom sample rules file was not found. Expected config/inkloom-rules.json.",
    );
  }
  const rules = JSON.parse(readFileSync(configPath, "utf8")) as BrandRule[];
  const insert = database.prepare(`
    INSERT INTO inkloom_rules
      (id, category, name, description, pattern, replacement, severity, enabled, sample)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const rule of rules) {
    insert.run(
      rule.id,
      rule.category,
      rule.name,
      rule.description,
      rule.pattern,
      rule.replacement,
      rule.severity,
      Number(rule.enabled),
      Number(rule.sample),
    );
  }
}

seedConfiguredRules();

export function listRules(): BrandRule[] {
  const rows = database
    .prepare("SELECT * FROM inkloom_rules ORDER BY category, name")
    .all() as DbRow[];
  return rows.map(mapRule);
}

export function createRule(input: RuleInput): BrandRule {
  const rule: BrandRule = {
    id: randomUUID(),
    category: input.category,
    name: input.name.trim(),
    description: input.description.trim(),
    pattern: input.pattern.trim(),
    replacement: input.replacement?.trim() || null,
    severity: input.severity,
    enabled: input.enabled,
    sample: false,
  };
  database
    .prepare(`
      INSERT INTO inkloom_rules
        (id, category, name, description, pattern, replacement, severity, enabled, sample)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      rule.id,
      rule.category,
      rule.name,
      rule.description,
      rule.pattern,
      rule.replacement,
      rule.severity,
      Number(rule.enabled),
      Number(rule.sample),
    );
  return rule;
}

export function updateRule(
  id: string,
  update: Partial<RuleInput>,
): BrandRule | null {
  const currentRow = database
    .prepare("SELECT * FROM inkloom_rules WHERE id = ?")
    .get(id) as DbRow | undefined;
  if (!currentRow) return null;
  const current = mapRule(currentRow);
  const next: BrandRule = {
    ...current,
    ...update,
    name: update.name?.trim() ?? current.name,
    description: update.description?.trim() ?? current.description,
    pattern: update.pattern?.trim() ?? current.pattern,
    replacement:
      update.replacement === undefined
        ? current.replacement
        : update.replacement?.trim() || null,
  };
  database
    .prepare(`
      UPDATE inkloom_rules
      SET category = ?, name = ?, description = ?, pattern = ?, replacement = ?,
          severity = ?, enabled = ?
      WHERE id = ?
    `)
    .run(
      next.category,
      next.name,
      next.description,
      next.pattern,
      next.replacement,
      next.severity,
      Number(next.enabled),
      id,
    );
  return next;
}

export function deleteRule(id: string): boolean {
  const result = database
    .prepare("DELETE FROM inkloom_rules WHERE id = ?")
    .run(id);
  return Number(result.changes) > 0;
}

function appendAudit(
  reviewId: string,
  action: string,
  actor: string,
  reason: string | null,
  at: string,
): void {
  database
    .prepare(
      "INSERT INTO inkloom_audit (review_id, action, actor, reason, at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(reviewId, action, actor, reason, at);
}

export function createReview(
  input: ReviewInput,
  findings: Finding[],
): Review {
  const now = new Date().toISOString();
  const review: Review = {
    id: randomUUID(),
    title: input.title.trim(),
    channel: input.channel.trim(),
    content: input.content,
    status: "Pending",
    findings,
    auditLog: [],
    reviewer: null,
    decisionReason: null,
    createdAt: now,
    updatedAt: now,
  };
  database.exec("BEGIN");
  try {
    database
      .prepare(`
        INSERT INTO inkloom_reviews
          (id, title, channel, content, status, findings_json, reviewer, decision_reason, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        review.id,
        review.title,
        review.channel,
        review.content,
        review.status,
        JSON.stringify(review.findings),
        null,
        null,
        review.createdAt,
        review.updatedAt,
      );
    appendAudit(review.id, "Review submitted", "Content author", null, now);
    database.exec("COMMIT");
    return getReview(review.id) ?? review;
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

export function getReview(id: string): Review | null {
  const row = database
    .prepare("SELECT * FROM inkloom_reviews WHERE id = ?")
    .get(id) as DbRow | undefined;
  return row ? mapReview(row) : null;
}

export function listReviews(): Review[] {
  const rows = database
    .prepare("SELECT * FROM inkloom_reviews ORDER BY created_at DESC")
    .all() as DbRow[];
  return rows.map(mapReview);
}

export function decideReview(
  id: string,
  decision: { status: Exclude<ReviewStatus, "Pending">; reviewer: string; reason: string },
): Review | null {
  const current = getReview(id);
  if (!current) return null;
  const now = new Date().toISOString();
  const reason = decision.reason.trim();
  const reviewer = decision.reviewer.trim();
  database.exec("BEGIN");
  try {
    database
      .prepare(`
        UPDATE inkloom_reviews
        SET status = ?, reviewer = ?, decision_reason = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(decision.status, reviewer, reason, now, id);
    appendAudit(id, `Marked ${decision.status}`, reviewer, reason, now);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  return getReview(id);
}

export interface Dashboard {
  totalReviews: number;
  pendingReviews: number;
  needsChanges: number;
  approvedReviews: number;
  openFindings: number;
  highRiskFindings: number;
  recentReviews: Review[];
  recentActivity: Array<{
    id: string;
    reviewTitle: string;
    action: string;
    actor: string;
    at: string;
  }>;
}

export function getDashboard(): Dashboard {
  const reviews = listReviews();
  const findings = reviews.flatMap((review) => review.findings);
  const activityRows = database
    .prepare(`
      SELECT a.id, r.title AS review_title, a.action, a.actor, a.at
      FROM inkloom_audit a
      JOIN inkloom_reviews r ON r.id = a.review_id
      ORDER BY a.id DESC
      LIMIT 8
    `)
    .all() as DbRow[];
  return {
    totalReviews: reviews.length,
    pendingReviews: reviews.filter((review) => review.status === "Pending").length,
    needsChanges: reviews.filter((review) => review.status === "Needs Changes").length,
    approvedReviews: reviews.filter((review) => review.status === "Approved").length,
    openFindings: findings.filter((finding) => finding.status === "open").length,
    highRiskFindings: findings.filter(
      (finding) => finding.status === "open" && finding.severity === "high",
    ).length,
    recentReviews: reviews.slice(0, 5),
    recentActivity: activityRows.map((row) => ({
      id: String(row.id),
      reviewTitle: String(row.review_title),
      action: String(row.action),
      actor: String(row.actor),
      at: String(row.at),
    })),
  };
}

export function getReviewCount(): number {
  const result = database
    .prepare("SELECT COUNT(*) AS count FROM inkloom_reviews")
    .get() as DbRow | undefined;
  return Number(result?.count ?? 0);
}
