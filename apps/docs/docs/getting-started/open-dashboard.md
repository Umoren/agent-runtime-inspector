# Open the dashboard

1. Start the collector and dashboard:

   ```bash
   pnpm dev
   ```

2. Open `http://localhost:3005`.

3. Select a run to inspect its recorded evidence.

The run view shows:

It shows:

- run summary and status
- context path events
- action path events
- model path events
- system lifecycle events

The raw event panel shows the underlying payloads for debugging.

A successful status only says that the run completed. Read the context and action paths to see which evidence supported it.
