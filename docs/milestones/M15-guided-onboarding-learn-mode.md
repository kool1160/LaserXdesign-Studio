# M15 — Guided Onboarding and Learn Mode

## User-visible outcome

A first-time user opens LaserX, chooses a real goal, follows clear shop-language guidance, completes a usable sign, views it in 3D, and exports it without needing the owner, CAD knowledge, or an external tutorial.

## Activation gate

M15 remains blocked until M14 is reviewed, merged, closed, recorded complete, and explicitly advanced by the owner.

## Included

- first-run paths: **Create My First Sign**, **Import My Own Design**, and **Describe What I Want With AI — Optional**;
- guided steps that highlight the exact control, explain what it does and why it matters, dim unrelated areas, confirm completion, and preserve orientation between screens;
- a reusable tutorial state machine separated from feature logic;
- skip, replay, resume, and Help/Learn access;
- plain shop-language explanations for layers, bridges, islands, cutability, material, thickness, 3D preview, and export;
- deterministic non-AI sign creation as the default path;
- AI path hidden or clearly optional when no provider is connected;
- sample projects that teach real workflows rather than disconnected slides;
- progress and recovery behavior that cannot corrupt the project or trap the user;
- measurable first-session instrumentation that is local/privacy-respecting unless a later explicit opt-in design is accepted.

## Acceptance tests

1. A clean first launch presents the three clear goal paths without exposing a blank unexplained workspace as the only choice.
2. A user can complete a deterministic first sign through dimensions, text, material, cutability, physical 3D preview, save, and export.
3. A user can import SVG or DXF, understand conversion/repair findings, assign physical information, preview, and export.
4. The optional AI path remains unavailable or clearly optional without breaking the normal product.
5. Tutorials can be skipped, replayed, resumed, and reopened.
6. Guidance never performs hidden destructive edits or bypasses existing validation.
7. Keyboard, high-DPI, focus, screen-reader labels, and non-color-only progress states pass.
8. Packaged E2E proves users cannot become permanently trapped in tutorial state.
9. Structured owner-observed usability sessions show the primary workflow can be completed within ten minutes on the documented fixture set.

## Exit checklist

- [ ] Tutorial architecture and state boundaries are documented.
- [ ] Create, import, and optional-AI guided paths pass.
- [ ] Learn Mode covers the core manufacturing concepts.
- [ ] Skip/replay/resume/recovery pass.
- [ ] Accessibility and packaged Windows evidence pass.
- [ ] Owner-observed first-session evidence is recorded.
- [ ] Status advances to M16 only after exact-head audit, merge, issue closure, and owner approval.

## Explicitly excluded

No broad material expansion, new process profiles, export-profile system, new AI provider capability, licensing, public beta, analytics platform, CAD, CAM, or machine control belongs in M15.
