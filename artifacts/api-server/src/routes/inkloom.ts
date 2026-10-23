import { Router, type IRouter } from "express";
import {
  CreateInkloomReviewBody,
  CreateInkloomReviewResponse,
  CreateInkloomRuleBody,
  CreateInkloomRuleResponse,
  DecideInkloomReviewBody,
  DecideInkloomReviewParams,
  DecideInkloomReviewResponse,
  DeleteInkloomRuleParams,
  DeleteInkloomRuleResponse,
  GetInkloomDashboardResponse,
  GetInkloomReviewParams,
  GetInkloomReviewResponse,
  ListInkloomReviewsResponse,
  ListInkloomRulesResponse,
  UpdateInkloomRuleBody,
  UpdateInkloomRuleParams,
  UpdateInkloomRuleResponse,
} from "@workspace/api-zod";
import {
  createReview,
  createRule,
  decideReview,
  deleteRule,
  getDashboard,
  getReview,
  getReviewCount,
  listReviews,
  listRules,
  updateRule,
} from "../lib/inkloom-store";
import { analyzeContent } from "../lib/rules-engine";

const router: IRouter = Router();

const demoContent =
  "InkloomAI is the world's best platform. We guarantee 100% accurate, risk-free results. Click here to get started! GRAB YOURS NOW!";

if (getReviewCount() === 0) {
  createReview(
    {
      title: "Spring launch email",
      channel: "Email",
      content: demoContent,
    },
    analyzeContent(demoContent, listRules()),
  );
}

router.get("/inkloom/dashboard", (_req, res): void => {
  res.json(GetInkloomDashboardResponse.parse(getDashboard()));
});

router.get("/inkloom/reviews", (_req, res): void => {
  res.json(ListInkloomReviewsResponse.parse(listReviews()));
});

router.post("/inkloom/reviews", (req, res): void => {
  const parsed = CreateInkloomReviewBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid Inkloom review input");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const review = createReview(
    parsed.data,
    analyzeContent(parsed.data.content, listRules()),
  );
  res.status(201).json(CreateInkloomReviewResponse.parse(review));
});

router.get("/inkloom/reviews/:id", (req, res): void => {
  const params = GetInkloomReviewParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const review = getReview(params.data.id);
  if (!review) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  res.json(GetInkloomReviewResponse.parse(review));
});

router.patch("/inkloom/reviews/:id/decision", (req, res): void => {
  const params = DecideInkloomReviewParams.safeParse(req.params);
  const parsed = DecideInkloomReviewBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const review = decideReview(params.data.id, {
    status: parsed.data.status,
    reviewer: parsed.data.reviewer,
    reason: parsed.data.reason,
  });
  if (!review) {
    res.status(404).json({ error: "Review not found" });
    return;
  }
  res.json(DecideInkloomReviewResponse.parse(review));
});

router.get("/inkloom/rules", (_req, res): void => {
  res.json(ListInkloomRulesResponse.parse(listRules()));
});

router.post("/inkloom/rules", (req, res): void => {
  const parsed = CreateInkloomRuleBody.safeParse(req.body);
  if (!parsed.success) {
    req.log.warn({ errors: parsed.error.message }, "Invalid Inkloom rule input");
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rule = createRule(parsed.data);
  res.status(201).json(CreateInkloomRuleResponse.parse(rule));
});

router.patch("/inkloom/rules/:id", (req, res): void => {
  const params = UpdateInkloomRuleParams.safeParse(req.params);
  const parsed = UpdateInkloomRuleBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rule = updateRule(params.data.id, parsed.data);
  if (!rule) {
    res.status(404).json({ error: "Brand rule not found" });
    return;
  }
  res.json(UpdateInkloomRuleResponse.parse(rule));
});

router.delete("/inkloom/rules/:id", (req, res): void => {
  const params = DeleteInkloomRuleParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!deleteRule(params.data.id)) {
    res.status(404).json({ error: "Brand rule not found" });
    return;
  }
  DeleteInkloomRuleResponse.parse(undefined);
  res.status(204).end();
});

export default router;
