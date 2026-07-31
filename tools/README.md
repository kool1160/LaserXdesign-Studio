# Developer Tools

Internal utilities for auditing and inspecting artifacts. They are not shipped as product features unless a milestone explicitly promotes them.

`generate-m03-project-fixtures.ts` is the reviewed source for the schema-v3
editing golden and deterministic v2-to-v3 migration golden. Bundle and run it
from the repository root only when an intentional schema change has been
reviewed; project-format tests fail if generated output differs from committed
fixtures.
