# Social Post Video Isolation Design

## Goal

Prevent video-specific language and decisions from appearing while RoMes is consulting on a social post, without removing Momo or the independent video-production capability.

## Root cause

The marketing brief uses one hard-coded call-to-action question for both `social_post` and `video_campaign`. The shared question says “sau video”, so a valid social-post consultation displays video language even though the campaign is not a video campaign.

## Scope

- Select consultation questions using the campaign content type.
- Use social-post wording for the social-post call to action.
- Keep the social-post orchestration among RoMes, Poppy, and Finch unchanged.
- Keep Momo and the video-production path unchanged and isolated from social posts.
- Keep internal safeguards that prohibit social posts from invoking Momo or video rendering.

## Behavior

For `social_post`, the call-to-action question asks what the reader should do after reading the post. It must not mention video, duration, voice-over, rendering, or Momo.

For `video_campaign`, the existing video-specific questions and Momo workflow remain available.

## Testing

Add a regression test that creates an incomplete social-post brief and verifies that its consultation questions contain the social-post call-to-action wording and contain no video terminology. Existing video-brief tests continue to verify that video campaigns retain their duration question.

## Non-goals

- Removing Momo.
- Deleting the video engine, video tools, schemas, or tests.
- Changing the sequential RoMes → Poppy → Finch social-post workflow.
