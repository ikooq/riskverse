# Design QA — RISKVERSE

**Date:** 2026-10-25 (previous comparison: 2026-10-24)  
**Result:** `final result: passed`

## Reviewed surfaces

| Surface | Viewport | State | Evidence |
|---|---:|---|---|
| Main workspace | 1265 × 744 | Warehouse photo, confirmed AI observations, risk panel | `output/playwright/photo-view.png` |
| New audit | 390 × 844 | Upload form and validation | `output/playwright/new-audit-dialog.png` |
| New audit created | 390 × 844 | Uploaded photo in an empty audit, AI consent required | `output/playwright/new-audit-created.png` |
| Responsive navigation | 390 × 844 | Workflow steps remain on one line and can scroll horizontally | `output/playwright/mobile-view.png` |
| Slide deck | 1280 × 720 each | All seven slides rendered; slide 3 rechecked after correction | `output/playwright/deck-montage.png`, `output/playwright/deck-slide-03.png` |

The visual comparison uses `photo-workspace.png` as the earlier product reference and `output/playwright/photo-view.png` as the current implementation at the same 1265 × 744 viewport. The side-by-side capture is `output/playwright/design-comparison.png`. The current page preserves the photo-first workspace and inspection panel while using the newer navigation and visual system; the compared screenshots show different sample photos and app data.

## Fidelity and interaction checks

- The current interface uses a warm light canvas, deep green navigation and panels, lime action accents, and a consistent system-font stack. Text, icons, cards, and floor-plan overlays remain legible at the reviewed sizes.
- The main workspace photograph and AI evidence now appear above the supporting guidance on desktop. The mobile workflow strip no longer breaks labels into multiple lines.
- New-audit form rejects submission without a photo. After upload, the new audit opens with the image visible, and analysis stays disabled until the external-provider consent is checked.
- Copy describes an external AI provider without incorrectly naming OpenAI while Gemini is configured. The local favicon is present.
- Browser console check after the favicon fix: zero errors and zero warnings during the reviewed flow.
- All seven presentation slides were reviewed. Slide 3 initially clipped its heading; its title was shortened and the regenerated slide now renders cleanly. The final presentation package and layout validators report zero findings and zero warnings.

## Remaining low-priority polish

- Keyboard-only navigation and screen-reader behavior have not received a full accessibility audit.
- The presentation has been rendered and package-validated, but has not been opened in a native PowerPoint installation.
- A physical site measurement is still needed before claiming that any floor-plan dimensions or photo-to-plan calibration represent a real facility.

No blocking visual defects remain in the reviewed desktop, mobile, or presentation surfaces.

## Production acceptance — 2026-10-25

The built frontend and API were reviewed together through `npm start`, with an isolated browser at `127.0.0.1:8789`. Current release evidence:

| Surface | Viewport / state | Evidence |
|---|---|---|
| Built application | 1440 × 1000, 2D plan after applying a calculated placement; model findings change from 2 to 1 | `output/playwright/finished-production.png` |
| Mobile application | 390 × 844, saved AI example; no horizontal document overflow | `output/playwright/finished-mobile.png` |
| Exported report | Two standalone SVG plans with differing layouts and counts, five objects, four saved AI observations | `output/playwright/finished-report.png`, `output/playwright/finished-report.html` |

- A real Gemini request on the public warehouse photograph returned four observations. The complete image and AI record survived reload and full-audit export.
- Importing a scene with another source removed the prior photo. Recovery restored the entire previous audit, including the saved Gemini response. Opening and returning from a scenario was also checked.
- The supplied saved AI example opens with **zero** new `/api/analyze` requests; its provenance is labelled in the UI.
- Fixed inherited dark styles that made the photo heading, neutral metric and button hover text hard to read. Report markers were enlarged after inspection. Current light surfaces and text were reviewed again at desktop and mobile sizes.
- The standalone report has two SVG plans and no external scripts or stylesheets. A constrained local HTTP viewer was used to render the generated file because the test browser blocks the `file:` protocol.
- CSP initially prevented reading local image data; `connect-src` now permits local `data:` and `blob:` URLs while external requests still go through the same-origin API. A missing JSON MIME entry initially blocked the supplied example; it is fixed and covered by runtime tests. Fresh production-page checks after these repairs produced no new browser errors.

Earlier comparison captures remain development history; the four current evidence files above are included in the release allowlist. Physical calibration and expert AI quality evaluation remain outside the claims of this visual/functional acceptance check.

final result: passed
