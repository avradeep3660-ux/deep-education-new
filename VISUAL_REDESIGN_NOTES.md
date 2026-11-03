# Deep Education — Visual Redesign

This update is a visual/UI redesign only. Existing React state, Firestore collection names, event handlers, student/teacher actions, and feature logic were intentionally preserved.

## Design changes
- Rebuilt the landing screen as a two-column welcome + access experience.
- Kept the dark visual direction and replaced the low-contrast light treatment with a deep navy interface, cyan/blue highlights, and restrained violet accents.
- Added a branded hero, learning-feature chips, educator identity strip, and animated ambient orbit details.
- Added a dedicated teacher workspace welcome header.
- Restyled student and teacher navigation as a sticky, horizontally scrollable glass dock.
- Unified panel, form, button, modal, typography, spacing, and focus styles across existing feature screens.
- Added responsive layouts and reduced-motion support.

## Run locally
From `DeepEducation/my-app`:

```bash
npm ci
npm run dev
```

## Build for hosting

```bash
npm run build
```

Deploy the generated `dist` folder using the existing hosting workflow after verifying Firebase environment settings and the required backend migration steps.

## Verification note
The updated JSX was parsed successfully and the CSS stylesheet passed PostCSS syntax parsing. A Vite production build could not be completed in the authoring environment because the pre-existing installed dependency tree is missing the platform-specific optional Rolldown native binding. Reinstall dependencies with `npm ci` on the target computer before building.
