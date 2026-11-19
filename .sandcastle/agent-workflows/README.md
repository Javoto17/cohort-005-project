# Factory agent

All four GitHub workflows use **OpenCode Go** with **`opencode-go/gpt-6-luna`**,
configured in `shared/common.ts`. The historical `claudeAgent` export stays
unchanged so every consumer uses the same configuration.

## GitHub secrets

- **`OPENCODE_API_KEY`**: a personal Console API key for a member covered by Go,
  in the workspace with the active subscription. Grant **Models → Request**;
  a read-only key cannot run inference. Create it under **Account → Personal
  API keys**, then save it as a repository Actions secret. Never commit its value.
- **`FACTORY_PAT`**: the existing GitHub credential for issue and PR operations.
  It is separate from the model key and is not passed to the agent step.

The workflows no longer inject `OPENAI_API_KEY` or `GEMINI_API_KEY`. Their
repository secrets can remain for other consumers; they do not select Go.

## Subscription and cost

The `opencode-go` provider selects the Go endpoint, rather than OpenAI directly
or Console pay-as-you-go. The key alone does not select the subscription.

Turn **Extra Usage off** in Console's Go settings if runs must stop when the
allowance is exhausted instead of consuming workspace credits. The workflow
cannot enforce this account setting. Go's five-hour, weekly and monthly limits
still apply, and concurrent agent runs share the applicable allowance.

Use a personal key for a covered member. Do not assume a service account has
subscription access: the Go documentation explicitly excludes service accounts
from Go Teams coverage.

To confirm billing during a real run, check Console usage or the API usage
metadata: `opencode.billing_source` should be `go` or `go-plus`, and `cost`
should be zero within the allowance. Local tests do not verify subscription
status, available quota or billing.

## Local checks

```bash
npx tsc --noEmit -p .sandcastle/agent-workflows
npx vitest run .sandcastle/agent-workflows/shared/common.test.ts
```

The agent uses a standalone OpenCode server so the step's key also reaches
extraction runs. Session storage and structured-output validation are retained.

Sources: [Go](https://opencode.ai/docs/console/go),
[API keys](https://opencode.ai/docs/console/api),
[inference billing](https://opencode.ai/docs/console/api/inference#cost).
