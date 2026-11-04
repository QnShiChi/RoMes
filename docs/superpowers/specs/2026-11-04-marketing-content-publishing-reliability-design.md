# Marketing Content and Social Publishing Reliability Design

**Date:** 2026-11-04

## 1. Purpose

Make the Marketing team produce reviewable content with relevant real-world images, deliver durable previews in chat, and publish only through a verified social account and destination.

The design covers three connected but independently deliverable subsystems:

1. brief consultation, copy production, and campaign revisions;
2. real-image search, relevance ranking, provenance, and chat delivery;
3. social account discovery, publishing, and evidence.

Each subsystem gets its own implementation plan and isolated verification. Their shared boundary is the persisted campaign manifest and typed artifacts.

## 2. Current Problems

The current RoMes instructions fill missing brief fields, approve the resulting revision, and dispatch production in the same turn. This bypasses the existing brief assessment and makes the team appear unresponsive to the person's actual goals.

Poppy and Finch are dispatched concurrently even though Finch needs Poppy's visual prompts. Poppy's post remains conversation text rather than a campaign artifact, so later publishing depends on transcript recall.

The default image path searches Bing Images and downloads source files. It returns both local paths and remote source URLs. RoMes can expose the remote URL instead of delivering the local artifact, which makes previews depend on expiring links and hotlink policies. Image selection checks format and broad dimensions but does not rank semantic fit strongly enough.

The publishing adapters operate the currently signed-in browser. They advertise capabilities before checking the active account or destination, several adapters ignore image paths, and a successful button click is treated as a successful post. When no canonical post URL is observed, the adapter can manufacture evidence. Threads has no independent platform contract.

## 3. Goals

- Ask for or confirm decisions that materially affect the result before production.
- Preserve fast execution when the request is already sufficiently specific.
- Persist the exact approved post, visual prompts, images, and platform variants.
- Use real images found through search; do not generate images with an image model.
- Select images by relevance, quality, provenance, diversity, and rights risk rather than result order.
- Deliver image previews from durable local attachments, never remote hotlinks.
- Identify the exact social account, destination, connection mode, and visibility before publishing.
- Support API/OAuth connections when available and a verified browser-session fallback.
- Claim success only after receiving or observing a real provider post identifier and canonical URL.
- Keep failed publishing attempts retryable without regenerating content or images.

## 4. Non-goals

- Building an image-generation pipeline.
- Circumventing CAPTCHA, OTP, provider review, account restrictions, or rate limits.
- Extracting passwords, cookies, session tokens, or browser credentials.
- Automatically accepting unknown image licensing terms.
- Producing one universal caption that ignores platform-specific limits and conventions.
- Creating a general-purpose workflow engine or new campaign dashboard in the first implementation.

## 5. Consultation Policy

RoMes uses a balanced consultation policy.

The topic and deliverable type must be explicit. Platform, intended audience, goal, style, call to action, image count, account, and visibility retain provenance: `user`, `proposed_default`, or `confirmed`.

If a missing decision materially changes the output, RoMes asks one compact question that groups the outstanding choices. It may present proposed defaults, but it must not mark them as user-provided. Production remains blocked until the person confirms the brief revision.

If all material choices are already explicit, RoMes may proceed without asking a redundant question. Publishing authorization is turn-scoped: a direct request such as “đăng bài này lên Facebook” authorizes that attempt only after the target account and destination are unambiguous.

The brief summary presented for confirmation includes:

- deliverable and topic;
- platform and destination type;
- audience and goal;
- tone and call to action;
- requested image count and aspect ratio;
- any proposed defaults.

## 6. Campaign and Artifact Contracts

The campaign manifest remains the source of truth. It gains explicit content, media, and publishing artifacts.

```ts
type FieldSource = "user" | "proposed_default" | "confirmed";

interface SourcedValue<T> {
  value: T;
  source: FieldSource;
}

interface MarketingPostArtifact {
  type: "social_post";
  campaignId: string;
  revision: number;
  platform: string;
  headline: string;
  body: string;
  callToAction: string;
  hashtags: string[];
  caption: string;
  visualPrompts: VisualPrompt[];
}

interface ImageArtifact {
  type: "image";
  campaignId: string;
  revision: number;
  filePath: string;
  sha256: string;
  width: number;
  height: number;
  mimeType: string;
  sourcePageUrl: string;
  sourceImageUrl: string;
  provider: string;
  query: string;
  relevanceScore: number;
  rightsRisk: "low" | "unknown" | "blocked";
}

interface PublishBundle {
  campaignId: string;
  revision: number;
  postArtifactId: string;
  imageArtifactIds: string[];
  platform: PublishPlatform;
  accountId: string;
  destinationId: string;
  visibility: string;
  idempotencyKey: string;
}
```

Conversation context carries campaign and artifact IDs, not guessed paths or copied snippets. A revision that changes only image count retains the approved post artifact and generates or removes only the necessary image assignments. A copy revision invalidates platform variants but does not delete unrelated, still-referenced files.

## 7. Production Orchestration

The social-post flow is sequential where a real dependency exists:

```text
classify request
  -> prepare sourced brief
  -> consult or confirm
  -> approve exact revision
  -> Poppy returns typed post and visual prompts
  -> validate and persist post artifact
  -> Finch receives those exact visual prompts
  -> search, rank, and persist exactly N images
  -> deliver local attachments
  -> present post and previews
```

Poppy has no production or publishing tools. Its response is validated before persistence. Finch does not invent replacement prompts when Poppy's output is missing or invalid; it returns a typed input error.

The coordinator reports completion only after the requested artifact count is present and deliverable. A partial result is explicit and includes the missing positions and retry action.

## 8. Real-Image Search and Ranking

### 8.1 Search plan

Each visual prompt is converted into a structured search plan:

- required entities, products, people, place, and action;
- optional visual concepts;
- excluded concepts;
- desired orientation and minimum dimensions;
- freshness requirement when the subject is time-sensitive;
- preferred source classes such as official product pages, company press rooms, reputable editorial sources, or permissive stock libraries.

The system issues several focused queries per visual slot instead of one long generative prompt. It gathers a bounded candidate pool from configured search providers and preserves both source page URL and direct image URL.

### 8.2 Hard filters

A candidate is rejected before scoring when it has:

- invalid magic bytes or unsupported format;
- dimensions below the slot minimum;
- an inaccessible or redirect-looping source;
- known thumbnail, avatar, reaction-video, watermark marketplace, or tracking URL patterns;
- an aspect ratio incompatible with the requested placement beyond the allowed crop tolerance;
- an exact or perceptual duplicate of an already selected campaign image;
- a blocked rights source.

### 8.3 Relevance scoring

Remaining candidates receive a deterministic score with recorded components:

```text
35% subject/entity match
20% source authority
15% visual-context match
10% resolution and crop fitness
10% freshness when required
10% diversity from already selected images
- rights-risk and watermark penalties
```

Entity and context matching use page title, image alt text, nearby text, source domain, filename, and search metadata. The first implementation uses lexical and structured-entity matching. A later optional reranker may use a non-generative vision/text embedding model, but selection must remain explainable and must not fabricate image contents.

The selected set must satisfy the requested count. If the confidence floor is not met, Finch reports that it could not find a suitable image for that slot instead of filling it with an unrelated result.

Only `low` rights-risk images may enter an automated publish bundle. An `unknown` image may be shown for review with its source and warning, but publishing it requires the person to replace it or explicitly accept that specific source. A `blocked` image is never delivered or published.

### 8.4 Local ownership and delivery

Every selected image is downloaded, validated, hashed, and stored inside its campaign revision before being registered. Remote URLs remain provenance metadata and are never the preview source.

RoMes delivers images by artifact ID through a campaign-aware attachment operation. The attachment resolver verifies campaign ID, revision, artifact ID, containment, hash, and MIME type. It never searches by basename across campaign directories.

The final message contains native image attachments. An optional “View source” action may open the source page, but it is separate from preview and download.

## 9. Social Connections and Publishing

### 9.1 Connection modes

Each social destination has one of three modes:

- `api`: an OAuth-authorized provider connection;
- `browser`: an existing signed-in browser session;
- `manual`: no automated publisher, so RoMes prepares a downloadable bundle.

OAuth authorization is platform-specific. It grants only the scopes, accounts, pages, or business destinations the person selected. Browser mode uses the existing session without reading or exporting credentials.

### 9.2 Account discovery and preflight

Capabilities are dynamic. Before publishing, the adapter reports:

- platform and connection mode;
- observed account identity;
- available destinations such as profile, page, or company page;
- supported media count and types;
- whether posting and requested visibility are currently available;
- blocking conditions such as sign-in, checkpoint, unsupported account type, or human verification.

If more than one account or destination is possible, RoMes asks the person to choose. A cached capability cannot authorize a later publish without a fresh bounded preflight.

### 9.3 Platform adapters

Facebook, Instagram, Threads, X, LinkedIn, and TikTok are separate platform contracts. Threads is never treated as an Instagram alias.

Each adapter validates its current content and media constraints, uploads every image in the bundle, applies the selected destination and visibility, submits once under the idempotency key, and verifies the result.

API mode is preferred because provider responses can supply stable identifiers. Browser mode must observe a post-completion state and obtain a real post URL or stable on-page identifier. Clicking a submit button alone is not evidence.

### 9.4 Evidence and failure states

Valid publish evidence contains:

- provider and connection mode;
- platform, account ID, and destination ID;
- provider post ID;
- canonical HTTPS URL on the correct platform domain;
- provider-observed publication time;
- hashes of the post and media artifacts used.

The adapter must not synthesize any evidence field. A publish failure returns the campaign to `ready` with an attempt record and retry classification. Uncertain submission status is distinct from failure; the adapter first checks for an existing post before allowing a retry.

## 10. Platform-specific Copy

The approved core post is immutable for its revision. Poppy may derive platform variants that preserve the claims and call to action while adapting length, hashtag count, line breaks, and tone.

Each variant is persisted and reviewed before cross-posting. Publishing never rebuilds a caption from transcript history.

## 11. User Experience

The conversation shows compact, truthful states:

```text
Needs brief -> Awaiting confirmation -> Copy ready
-> Images 3/5 -> Ready for review -> Ready to publish
-> Publishing to Facebook Page “RoMes AI” -> Published
```

Questions identify the decision needed and offer safe defaults. Worker reply chips remain progress details; RoMes does not claim completion until typed outputs and artifacts pass validation.

Before publishing, the confirmation summary names the platform, account, destination, visibility, caption variant, and media count. A direct request may satisfy confirmation only when all of those are already unambiguous.

## 12. Security and Privacy

- Never request, log, or copy social passwords, cookies, OAuth refresh tokens, or browser profile data into campaign artifacts.
- Store provider tokens only in the existing secret connection layer.
- Scope OAuth tokens to the smallest required permissions and selected destinations.
- Do not solve or bypass CAPTCHA, OTP, checkpoints, or provider review.
- Restrict attachment reads to registered campaign artifacts rather than filesystem guesses.
- Treat search pages, source pages, image metadata, and social UI text as untrusted input.
- Preserve source attribution and rights-risk metadata for every searched image.

## 13. Testing and Verification

### 13.1 Domain tests

- Missing material brief fields produce consultation and no production call.
- Proposed defaults retain their source and cannot be approved as user values without confirmation.
- Poppy output validation rejects a mismatched visual-prompt count.
- Finch cannot start before the post artifact exists.
- Changing five images to three reuses the post and updates only image assignments.
- Search ranking chooses a more relevant authoritative candidate over an earlier unrelated result.
- Low-confidence candidates produce a partial-result error rather than filler.
- Artifact delivery rejects a matching basename from another campaign.
- The declared 1–12 image contract matches implementation limits.

### 13.2 Publisher contract tests

- Capabilities omit signed-out or unavailable accounts.
- Every platform receives all requested media paths.
- Threads uses its own adapter and evidence domain.
- A button click without provider evidence does not mark the campaign published.
- Invalid or synthetic URLs are rejected.
- A failed attempt returns to `ready` and is safely retryable.
- Repeating an idempotency key does not create a duplicate post.

### 13.3 Isolated end-to-end fixture

Use the repository verification fixture and synthetic search and social providers. Never use a person's live accounts or data.

The primary scenario is:

1. Ask RoMes for a technology article with incomplete requirements.
2. Verify one concise consultation response and no teammate dispatch.
3. Confirm a five-image Facebook post.
4. Verify Poppy completes before Finch begins.
5. Verify five relevant, locally stored image artifacts and five native chat previews.
6. Verify no remote image URL is used as a preview.
7. Publish through a synthetic Facebook capability and verify the exact stored caption, all five images, account, destination, and canonical evidence.
8. Repeat with a provider failure and verify the campaign remains ready.

The fixture also covers signed-out browser mode, multiple-account ambiguity, Threads routing, and a dead source URL after the local image has already been stored.

## 14. Delivery Sequence

The work is implemented in three slices with separate plans and review checkpoints:

1. **Consultation and content artifacts:** sourced brief fields, explicit revision confirmation, typed Poppy output, persistence, and revision behavior.
2. **Image search and delivery:** structured queries, candidate ranking, provenance, exact-count selection, campaign-aware attachments, and preview verification.
3. **Social publishing:** connection registry, dynamic preflight, platform adapters, media upload, evidence, retry behavior, and manual bundles.

Slice 1 establishes the artifact contracts used by the other two. Slice 2 precedes production social publishing so every publish bundle contains durable media. Slice 3 can initially support verified browser fixtures while OAuth-backed connections are added per platform.

## 15. Success Criteria

The design is complete when an isolated fixture proves that RoMes asks before guessing material requirements, persists one reviewed post, selects the requested number of relevant real images, presents durable previews, identifies the exact social destination, and either returns verifiable publication evidence or an honest retryable failure.
