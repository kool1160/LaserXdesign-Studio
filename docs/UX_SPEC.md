# UX Specification

## Main workspace

```text
Menu / command bar
Tool rail | Canvas and rulers | Inspector
          |                    | Layers
Status bar: units, zoom, selection size, warnings
```

## Core interaction principles

- exact values are always available in the inspector;
- drag interactions show live dimensions;
- every destructive or topology-changing action supports undo;
- warnings point to the affected geometry;
- generated/traced changes use before/after preview;
- the user can keep editing while AI is unavailable;
- manufacturing settings are visible and never implied.

## First-run workflow

1. Choose new blank sign, import image/vector, or generate from prompt.
2. Choose dimensions and display units.
3. Choose a process preset or defer it.
4. Enter the editor.
5. Run cutability check before export.

## Accessibility

Keyboard navigation, visible focus, scalable UI, high-contrast warning states, text alternatives for icons, and non-color-only severity indicators are required for beta.
