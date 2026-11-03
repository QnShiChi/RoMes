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
true`, and the test lists the eleven marketing tools. New custom servers start
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

If the fake engine is scripted for tool calls, exercise these conversation
cases. Otherwise, the automated MCP test above is the deterministic proof of
the lifecycle; do not present an unscripted fake reply as model-behaviour
evidence.

1. Send RoMes `tạo cho anh một video`. The settled reply asks for the missing
   topic, goal, audience, platform, style, duration and CTA. The engine dump
   contains no marketing production tool call.
2. Complete and approve the brief, then run the deterministic production calls.
   Read the resulting `campaign.json`; its state is `ready` and it contains one
   video artifact.
3. Send RoMes `up video vừa rồi lên TikTok`. The turn resolves the ready video,
   checks publishing capability, and reports `no_configured_publisher`. It does
   not call `generate_marketing_video`, and `campaign.json` remains `ready`.

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
