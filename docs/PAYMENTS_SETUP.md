# Payments integration hook

Stripe hosted Checkout, customer portal, and signed subscription webhooks already exist. This checkpoint exposes their readiness to account settings and keeps payments out of the chat workspace.

## Current behavior

- `GET /api/plans` and authenticated `GET /api/billing` include a `billing` capability object: `provider`, `mode`, `checkoutReady`, and `portalReady`.
- The account settings hook (`extension/sidepanel/useBilling.tsx`) reads readiness. It does not create a checkout on mount, page load, or a chat request.
- Checkout can open only after an explicit click and only when the server advertises a configured Stripe test provider. Account plan state changes only from a verified webhook, never from the checkout success redirect.
- Missing configuration leaves current access unchanged and displays “Payments are not enabled yet.” Mock billing is not advertised as a purchasable plan.
- Live Stripe keys and live events remain rejected. This is a preparation hook, not live-payment activation.

## Details still needed

1. Product and plan names, included limits, and intended price/currency/billing interval. The current provider accepts monthly USD test prices only; other billing models need an implementation change.
2. The public HTTPS application/service origin and intended success/cancel destinations.
3. Stripe test price ID and webhook configuration. Put secrets directly in the server's environment, not in chat or extension configuration.
4. Subscription lifecycle, cancellation/refund policy, customer portal configuration, and billing support contact.

## Test setup

Server environment: `STRIPE_SECRET_KEY` (`sk_test_…`), `STRIPE_PRICE_ID`, and `STRIPE_WEBHOOK_SECRET` (`whsec_…`). Webhook route: `/api/billing/webhook`. Configure `checkout.session.completed` and relevant `customer.subscription.*` events. Keep the signing secret server-only.

Once configured, restart the API, open Account → Plan & payments, and use “Open test checkout.” Verify successful, canceled, failed, delayed, duplicate, and out-of-order events. Refresh account status to confirm the webhook-derived plan. No live payments or external Stripe dashboard changes were performed in this checkpoint.
