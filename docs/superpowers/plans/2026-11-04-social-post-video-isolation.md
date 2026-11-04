# Social Post Video Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure social-post consultation uses reader/post wording and never displays video-specific questions.

**Architecture:** Keep the existing shared brief assessment and choose the CTA question from a small content-type-specific question map. Preserve the separate video question and all orchestration paths.

**Tech Stack:** TypeScript, Vitest, pnpm

---

### Task 1: Make CTA consultation content-type-aware

**Files:**
- Modify: `server/marketing/brief.test.ts`
- Modify: `server/marketing/brief.ts`

- [ ] **Step 1: Write the failing regression test**

Add this case inside `describe("marketing consultation", ...)`:

```ts
it("does not use video language while consulting on a social post", () => {
  const result = assessMarketingBrief({
    contentType: "social_post",
    topic: "Muse AI của Meta",
    goal: "Tăng tương tác",
    audience: "Người quan tâm AI",
    platform: "Facebook",
    style: "Phân tích dễ hiểu",
    imageCount: 5,
    fieldSources: {
      contentType: "user",
      topic: "user",
      goal: "user",
      audience: "user",
      platform: "user",
      style: "user",
      imageCount: "user",
    },
  });

  expect(result.complete).toBe(false);
  if (result.complete) throw new Error("expected an incomplete brief");
  expect(result.questions).toEqual([
    "Anh muốn người đọc thực hiện hành động nào sau khi đọc bài viết?",
  ]);
  expect(result.questions.join(" ").toLowerCase()).not.toContain("video");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm vitest run server/marketing/brief.test.ts
```

Expected: FAIL because the actual CTA question still says `sau video`.

- [ ] **Step 3: Implement the minimal content-type-specific question selection**

In `server/marketing/brief.ts`, retain the existing general questions, remove `callToAction` from that shared map, and add:

```ts
const CALL_TO_ACTION_QUESTIONS: Record<MarketingBrief["contentType"], string> = {
  social_post: "Anh muốn người đọc thực hiện hành động nào sau khi đọc bài viết?",
  video_campaign: "Anh muốn người xem thực hiện hành động nào sau video?",
};
```

When mapping missing fields, select `CALL_TO_ACTION_QUESTIONS[contentType]` for `callToAction`; otherwise use the existing general question.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
pnpm vitest run server/marketing/brief.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Run the marketing regression suite**

Run:

```bash
pnpm vitest run server/marketing/brief.test.ts server/marketing/mcp-server.test.ts server/marketing/swarm/team.test.ts
```

Expected: all tests pass, including existing video behavior and team composition.

- [ ] **Step 6: Commit the fix**

```bash
git add server/marketing/brief.ts server/marketing/brief.test.ts
git commit -m "fix(marketing): isolate social post consultation wording"
```
