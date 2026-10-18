# Owner and beta access

Beta access is a server-side entitlement grant, not a Stripe discount, fake payment or checkout. It unlocks the configured Pro limits: by default unlimited account saves, depth and saved versions, history, and **500 AI actions/month**. Normal Free limits remain unchanged. No payment/subscription is created. Paid subscriptions take precedence; revoking a grant does not cancel a subscription.

## Redeem in the extension

Sign in → Account & saved workflows → Beta access code → Redeem code. The profile shows **PRO · Beta access**, its expiry (or no expiry) and no subscription-management button. Retry the existing save after redemption. Codes only work against the server/database where issued. This does not copy workflows between local and production services.

Redemption is authenticated, limited to five attempts/account/minute, transactional and once per code/account. Retrying an active redemption is idempotent and does not extend expiry or use another slot. Expired/revoked grants return to normal subscription/Free limits without deleting saved work. A code's redemption deadline is independent of its recipients' access expiry.

## Administration (trusted server shell only)

Run against the intended service's configured `WANDEL_DB`, with the existing environment loaded. Migration 005 runs at startup/build CLI. No public grant/code-creation API is provided.

```sh
npm run platform:access -- grant owner@example.com
npm run platform:access -- create-code 'Private beta testers' 20 90
npm run platform:access -- revoke-code CODE_ID
npm run platform:access -- revoke-user tester@example.com
```

- `grant`: grants a known account owner access without expiry; repeated calls are idempotent. It does not create/link an identity. Sign in to the intended service first.
- `create-code LABEL MAX_USES GRANT_DAYS`: generates a random code, printed once. The example permits 20 accounts, each receiving 90 days from redemption. Codes must be redeemed within 90 days of issuance. Only the SHA-256 digest is stored, not the raw code. Save the returned ID for revocation. Do not commit raw codes to source control.
- `revoke-code`: blocks new redemptions and revokes all grants issued by that code.
- `revoke-user`: revokes that account's owner/beta grants while preserving its paid subscription and saved work.

Restart the service after deploying this implementation; refresh the extension's account status. Grant/redemption changes after startup take effect immediately. Rebuild/reload the extension to see the new code form. Main/beta build output remains untouched by `npm run build:assistant`.

## Local checkpoint — October 18, 2026

The existing local owner account was granted no-expiry admin access in `.data/wandel.sqlite`. Verification found its three saved prototypes and confirmed `requireCreate` now succeeds with no save limit and 500 AI actions/month. A private tester code was issued for 20 accounts, 90 days each; its raw value is deliberately excluded here. This code/grant has **not** been created in a deployed database.

The local API was restarted on 127.0.0.1:4320 with assistant enabled and responded successfully. 340 tests passed across 42 files; isolated assistant and platform builds passed. Coverage includes code hashing, exhaustion, duplicate redemption, expiry/revocation, paid-subscription isolation, owner grants, direct API authentication/input/rate limits and the extension redemption UI. Native installed-extension code redemption remains a manual acceptance check.
