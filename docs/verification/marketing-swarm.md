# Marketing swarm safety and artifact reuse

What this covers: consultation before production, explicit campaign approval,
campaign-bound assets, idempotent video rendering, reuse of the ready MP4 for a
publish request, and an honest refusal when no real publisher is configured.

It does not prove a real TikTok or Facebook upload. That claim requires a
configured publisher adapter and provider evidence containing a post ID and
canonical URL.

## Automated domain and MCP fixture

The MCP test starts `server/marketing/mcp-server.ts` as a child process with a
temporary assets root and a loopback image server. It renders one real MP4,
calls the render tool twice, and proves that the second result reuses the same
artifact. It also proves that an unavailable publisher leaves the campaign in
`ready`.

```sh
pnpm exec vitest run \
  server/marketing/brief.test.ts \
  server/marketing/campaign-store.test.ts \
  server/marketing/social-post-artifact.test.ts \
  server/marketing/campaign-workflow.test.ts \
  server/marketing/publisher-gateway.test.ts \
  server/marketing/mcp-server.test.ts \
  server/marketing/swarm/team.test.ts
```

Expected: all tests pass. The test's temporary assets directory is removed in
`afterEach`; it never reads the person's marketing assets or bot configuration.

## Isolated OpenMausBot fixture

Start the foreground launcher in one terminal:

```sh
node --experimental-strip-types scripts/control-omb.ts launch
```

Keep it attached. Copy the printed fixture URL and data directory into
task-specific variables in a second terminal:

```sh
MARKETING_FIXTURE_URL=http://127.0.0.1:PORT
MARKETING_FIXTURE_DATA=/tmp/openmausbot-control-XXXX
```

Register the repository's marketing server only in that fixture. Replace
`/absolute/path/to/RoMes` with the checkout printed by `pwd`:

```sh
curl -sS -X POST "$MARKETING_FIXTURE_URL/api/mcp/servers" \
  -H 'content-type: application/json' \
  -d "{
    \"name\": \"marketing_studio\",
    \"command\": \"node\",
    \"args\": [\"--experimental-strip-types\", \"--no-warnings\", \"/absolute/path/to/RoMes/server/marketing/mcp-server.ts\"],
    \"env\": {\"MARKETING_ASSETS_ROOT\": \"$MARKETING_FIXTURE_DATA/marketing-assets\"},
    \"enabled\": true
  }"

curl -sS -X PATCH "$MARKETING_FIXTURE_URL/api/mcp/servers/marketing_studio" \
  -H 'content-type: application/json' -d '{"enabled":true}'

curl -sS -X POST "$MARKETING_FIXTURE_URL/api/mcp/servers/marketing_studio/test" \
  -H 'content-type: application/json' -d '{}'
```

Expected: the create request returns HTTP 201, the patch reports `enabled:
true`, and the test lists both `save_marketing_post` and `get_marketing_post`
among the marketing tools. New custom servers start
disabled even when the create body asks to enable them. `MARKETING_ASSETS_ROOT`
is used because custom MCP configuration rejects reserved `OMB_*` environment
names.

Review the team changes without writing them, then apply them to the fixture:

```sh
pnpm control:omb team apply server/marketing/swarm/team.yaml \
  --dry-run --url "$MARKETING_FIXTURE_URL"

pnpm control:omb team apply server/marketing/swarm/team.yaml \
  --url "$MARKETING_FIXTURE_URL"
```

Expected: four bots under Marketing. RoMes has routing, campaign, artifact and
publishing tools but no render tool; Momo has the render tool but no publishing
tool; Poppy has no marketing MCP tools. Engines that require their native tool
surface retain `native:*`.

If the fake engine is scripted for tool calls, exercise this conversation.
An unscripted model response is observational only; deterministic lifecycle
evidence comes from the MCP and artifact tests.

1. Send RoMes: `viết giúp anh bài về cuộc đua AI của các hãng công nghệ`.
   Expected: one compact `ask_user` card covering the proposed platform,
   audience, goal, CTA and image count. The transcript contains no
   `coordinate_bots` call.
2. Accept the proposed values but choose five images.
   Expected: a brief summary card for revision 1. `campaign.json` remains
   `needs_brief`.
3. Choose `Bắt đầu`.
   Expected: approval for revision 1, one Poppy assignment, then one `script`
   artifact created by `save_marketing_post`.
4. Read the coordinator transcript before Finch starts.
   Expected: Finch's assignment contains the exact `POST_ARTIFACT_ID`; there
   was no earlier Finch assignment.
5. Send a revised request changing only the image count.
   Expected: revision 2 requires confirmation and the old artifact is not
   presented as revision 2.

Read bounded evidence through the shared control surface:

```sh
pnpm control:omb messages RoMes --limit 20 --url "$MARKETING_FIXTURE_URL"
pnpm control:omb doctor --url "$MARKETING_FIXTURE_URL"
```

Keep only redacted messages, the campaign manifest, and MCP call names under
`.omb-scratch/verify-evidence/marketing-swarm/`. Do not retain capability
tokens, provider credentials, or raw MCP configuration.

Stop the foreground launcher with Ctrl-C. It removes the fixture home and its
temporary marketing assets. Never substitute the URL of a running personal
workspace in any command above.
