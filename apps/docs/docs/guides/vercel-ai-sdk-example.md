# Run the Vercel AI SDK example

1. Add the model and Merge credentials described in the environment-variable reference to `.env`.

2. Start the collector and dashboard with `pnpm dev`.

3. Run the example in another terminal:

   ```bash
   pnpm example:merge
   ```

The example records model and action events around a scripted workflow.

The example lives in:

```text
examples/vercel-ai-sdk-merge
```

The run can include:

- selected and excluded context
- model call and completion
- Merge tool listing
- Merge tool call and result
- run completion

Provider and Merge credentials are loaded from local environment variables. Keep the example pointed at a safe test account or repository when exercising write tools.
