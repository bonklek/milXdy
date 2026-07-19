# milXdy Hub And Add-ons Plan For 0.2.0

## Purpose

milXdy is becoming large enough that users should not have to run every feature just because they want one or two of them. The 0.2.0 goal should be to turn the extension into a customizable suite where the Hub is the user's home base for discovering, enabling, disabling, configuring, and placing feature apps.

This is a product and architecture plan for the 0.2.0 release. It does not need to block 0.1.x feature work.

## Product Positioning

0.2.0 should present milXdy as a core browser companion with optional apps.

- The base install remains one extension.
- The Hub becomes the first-run and ongoing management surface.
- The side app rail becomes the fast launcher for installed or pinned apps.
- Heavy features are off by default unless a user chooses a preset that includes them.
- Optional apps are described in plain user-facing terms, including performance and permission implications.

The user-facing language should prefer "Apps" or "Add-ons" over "modules" or "bundles." Internally, code can still use feature module terminology.

## Expected User Flow

### Fresh Install

1. User installs or updates milXdy.
2. milXdy opens a first-run Hub screen.
3. The Hub asks the user to choose a starting profile:
   - Lite
   - Social
   - Reader
   - Games
   - Full
   - Custom
4. The selected profile enables a curated set of apps.
5. The Hub shows the enabled apps and which ones are pinned to the side rail.
6. User can continue to X/Twitter with the selected setup.

The first-run flow must be skippable. If skipped, the default should be conservative: lightweight core helpers only, with heavy apps disabled until selected.

### Returning User

1. User opens the milXdy popup or the side rail settings button.
2. User sees the Hub with:
   - Installed Apps
   - Browse Apps
   - Rail
   - Updates
   - Health
3. User enables, disables, configures, pins, or unpins apps.
4. Changes take effect without requiring a full extension reinstall where possible.

### Side Rail Discovery

1. User sees an Add Apps button in the side rail settings panel.
2. Clicking it opens the Hub to Browse Apps.
3. User can add an app to the rail if it supports a rail surface.
4. The rail order remains draggable and persisted.

### App Installation Or Enablement

For 0.2.0, most "install" actions should mean "enable a bundled lazy app." The Hub should avoid implying that arbitrary third-party code is being downloaded and executed.

Possible app states:

- Not enabled
- Enabled
- Enabled and pinned
- Unavailable in this build
- Requires extra asset download
- Requires browser permission
- Requires service login

## Hub Information Architecture

### Main Hub

The Hub should replace the feeling of a giant settings page with a compact app manager.

Recommended top-level sections:

- Dashboard
- Browse Apps
- Installed Apps
- Side Rail
- Presets
- Health
- Updates

### App Card Requirements

Each app card should show:

- App name
- Icon
- One-sentence description
- Category
- Current state
- Primary action
- Secondary action, if relevant
- Performance label
- Permission or data note, if relevant
- Rail support indicator

Example labels:

- Light
- Medium
- Heavy
- Uses X/Twitter page data
- Uses RemiliaNET session
- Loads OCR assets on demand
- Loads model assets on demand

### App Detail Requirements

Each app should have a detail view with:

- What it does
- Where it appears
- Why it may affect performance
- What data or services it uses
- Feature settings
- Enable or disable action
- Pin or unpin from rail action, if supported
- Reset app settings action

## Suggested Presets

### Lite

Goal: minimal slowdown and clean default experience.

Suggested apps:

- Core Hub
- Side Rail
- Health
- Update status
- possibly Remilia Wiki if measured as cheap enough

### Social

Goal: X/Twitter enhancement without heavier game/model features.

Suggested apps:

- Remilia Wiki
- RemiStats
- RemiNet Chat
- Postreader without OCR preloading

### Reader

Goal: post reading, accessibility, and research-style use.

Suggested apps:

- Postreader
- Remilia Wiki
- OCR available on demand

### Games

Goal: playful Remilia and Maxxer surfaces.

Suggested apps:

- Beetol
- Miladymaxxer
- trophy shelf/banner features

### Full

Goal: current all-in suite.

Suggested apps:

- Everything available in the build

### Custom

Goal: user picks apps one by one.

The Custom flow should use checkboxes or toggles with short descriptions and clear heavy-feature labels.

## Technical Requirements

### App Registry

Add a central app registry. The registry should be the single source of truth for Hub presentation, lazy import entry points, defaults, rail support, and app metadata.

Suggested shape:

```ts
type MilxdyAppManifest = {
  id: string;
  name: string;
  description: string;
  category: "social" | "reader" | "game" | "music" | "utility" | "system";
  entry?: string;
  settingsKey: string;
  defaultEnabled: boolean;
  defaultRailPinned: boolean;
  supportsRail: boolean;
  performance: "light" | "medium" | "heavy";
  permissionNotes?: string[];
  dataNotes?: string[];
  assetNotes?: string[];
  unavailableReason?: string;
};
```

### Runtime Loading

The existing lazy feature bundle approach should become formal app loading.

Requirements:

- Disabled apps must not import their feature bundle on page load.
- Enabled apps may import only when their target surface is relevant.
- Heavy workers, OCR, models, and WASM must remain lazy after app import.
- App enablement changes should be observed by content scripts without full browser restart where possible.
- App disablement should call the app lifecycle `disable` or `dispose` path when available.

### Side Rail Integration

The rail should consume the same app registry instead of maintaining separate presentation assumptions.

Requirements:

- Only rail-capable apps can be pinned.
- Rail order persists independently from enabled state.
- Disabling an app removes or hides its active rail item.
- Re-enabling an app can restore its previous rail position.
- The rail settings panel links to the Hub app manager.

### Build Variants

0.2.0 should introduce build profiles, even if most users still download Full.

Suggested release zips:

- `milXdy-lite`
- `milXdy-social`
- `milXdy-games`
- `milXdy-full`

Requirements:

- Build script can include or exclude app bundles and static assets by profile.
- Manifest `web_accessible_resources` only includes assets present in that build.
- Hub can show apps unavailable in the current build with a clear explanation.
- GitHub release notes explain which zip to choose.

### Heavy Asset Strategy

Largest assets should be audited before 0.2.0.

Candidates:

- Miladymaxxer model files
- ONNX Runtime assets
- OCR worker/core/language assets
- chromaprint WASM
- generated wiki index

Preferred behavior:

- Heavy assets are excluded from Lite when possible.
- Heavy assets load only after the user enables the related app.
- If runtime asset download is used, it must be explicit, cached, and documented.
- If runtime asset download is not acceptable for extension policy or reliability, use build variants instead.

### Permissions

The Hub should surface permissions in user language, but actual extension manifest permissions remain constrained by browser rules.

Requirements:

- App metadata must list host permissions or sensitive capabilities in plain English.
- Build variants should reduce host permissions when possible.
- The privacy documentation must be updated for any new app/preset model.
- If optional permissions are introduced later, the Hub should request them only at the moment of use.

### Settings Migration

Existing users should not lose settings.

Requirements:

- Existing feature settings remain readable.
- New app registry maps old feature setting keys to app enablement state.
- First-run Hub should not overwrite existing enabled/disabled choices on update.
- A migration marker should be stored after 0.2.0 setup completes.

### Diagnostics

The Hub should make performance visible without overwhelming users.

Requirements:

- Health tab shows enabled apps.
- Health tab shows expensive app warnings when diagnostics detect high work.
- Diagnostics should identify loaded app bundles and active heavy workers.
- A bug report should include app enablement and build profile.

## App Candidate Mapping

Initial app candidates:

- Core Hub
- Side Rail
- Remilia Wiki Links
- Postreader
- Postreader OCR
- RemiStats
- RemiNet Chat
- Miladymaxxer
- Beetol
- Trophy Shelf / Banner Tools
- Miladychan Spotlight
- Music
- Tweet PNG Export
- Health / Diagnostics

Some candidates may stay grouped for 0.2.0 if splitting them would create too much settings or migration churn.

## Release Requirements

0.2.0 should not ship this as a visual-only Hub. It needs actual runtime and packaging value.

Minimum release bar:

- First-run Hub exists and is skippable.
- App registry drives Hub app cards.
- Existing feature toggles map to app enablement.
- Side rail pinning is managed from the Hub.
- Disabled apps remain lazy and do not import their feature bundles on initial X/Twitter page load.
- At least Lite and Full builds are produced.
- Release notes explain presets and build choices.
- User guide explains how to change apps after install.
- Privacy and permissions docs describe app-level behavior.
- Existing users retain settings.

## Non-Goals For 0.2.0

- Third-party arbitrary add-on marketplace.
- Downloading and executing unreviewed remote code.
- Chrome Web Store submission.
- Full cross-extension app pack architecture.
- A public app developer SDK.
- Perfect package minimization for every app.

These can be revisited after the Hub model proves useful.

## Risks

- Too many app cards can make the Hub feel more complex than the current popup.
- Build variants can increase release testing time.
- Browser extension policy may limit remote asset or code strategies.
- Splitting settings too aggressively can confuse existing users.
- Optional permissions can behave differently across Chromium and Firefox.
- Some features may still have hidden runtime work after being disabled if lifecycle cleanup is incomplete.

## Implementation Phases

### Phase 1: Registry And Hub UI

- Create app registry.
- Render Hub app cards from registry.
- Map current toggles to app enablement.
- Add first-run preset selection.
- Keep existing settings reachable from each app.

### Phase 2: Rail Management

- Add Hub-managed rail pinning.
- Add Add Apps entry point from rail settings.
- Persist rail pinning separately from app enabled state.
- Validate rail behavior across X/Twitter routes.

### Phase 3: Runtime Enforcement

- Audit all feature imports.
- Ensure disabled apps do not import bundles.
- Ensure disable paths clean up UI, timers, listeners, workers, and intervals where possible.
- Add diagnostics for loaded apps and heavy assets.

### Phase 4: Build Profiles

- Add build profile input to `scripts/build.mjs`.
- Generate Lite and Full builds first.
- Add Social and Games if the build profile system remains manageable.
- Verify manifests and web-accessible resources per profile.

### Phase 5: Documentation And Release

- Update README.
- Update user guide.
- Update privacy and permissions docs.
- Update install/update docs.
- Add 0.2.0 release notes explaining Hub, presets, and build zips.

## Open Questions

- Should the default fresh install be Lite or Social?
- Should OCR be its own app or a sub-feature under Postreader?
- Should Tweet PNG Export be grouped with RemiNet or treated as a standalone utility?
- Should Miladymaxxer and trophy/banner tools be one Games app or separate apps?
- Can any heavy assets be downloaded and cached after install without hurting reliability or policy compliance?
- How much Firefox support is required for optional permissions and build variants in 0.2.0?

## Success Criteria

0.2.0 is successful if a new user can install milXdy, choose a lightweight or full setup in under a minute, understand which apps are active, change their mind later, and avoid paying runtime cost for features they never enabled.
