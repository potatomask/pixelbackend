Project Scope
Build a simple “2D world landing page” platform where each creator has one small map. Visitors control one character, walk around, and interact with objects to view the creator’s content (bio, links, projects, contact, media). No multiplayer, no game progression, no combat.

Product Goal
Replace static landing pages with a lightweight exploratory experience that still behaves like a personal profile page.

Core Concept

Creator builds a small grid-based world.
Creator places block tiles and interactive objects.
Visitor opens shared URL and roams the world.
Visitor clicks/taps objects to open content panels or links.
Target Users

Creators who want a unique profile/portfolio page.
Visitors on mobile and desktop who need fast loading and easy navigation.
Success Criteria

First meaningful render is fast on mid-range mobile.
Visitor can move smoothly and interact reliably.
Creator can publish a world without technical knowledge.
Shared link works instantly without installs/logins.
Scope For V1 (In)

One world per creator.
Fixed-size grid map with tile placement.
Basic tile types:
Walkable floor
Solid wall/block
Decoration
Spawn point
Single-player visitor movement.
Collision with solid tiles.
Interactive objects with 3 actions:
Open modal/popup content
Open external link
Show image/media panel
Creator editor:
Place/remove tiles
Place/edit interactive objects
Save draft
Publish
Public page:
Visit by URL
Touch controls on mobile
Keyboard controls on desktop
Basic creator profile metadata:
Name
Avatar
Theme colors
Short description
Analytics-lite:
Page visits
Object interactions count
Out Of Scope For V1 (Not In)

Multiplayer or realtime presence.
Inventory, quests, combat, NPC AI.
User-generated scripting.
Fully custom animation editor.
Large/open-world streaming maps.
Advanced SEO page-builder parity.
In-app economy/marketplace.
Deep CMS workflows.
Functional Requirements

Creator auth and dashboard.
Create, edit, save, publish/unpublish world.
Version-safe publish flow (published world separate from draft).
Visitor movement with smooth camera follow.
Collision checks per tile.
Object trigger system with cooldown/debounce.
Responsive layout and controls for mobile.
Public share URL and creator slug routing.
Basic moderation/report mechanism for abusive links/content.
Error-safe fallback if assets fail to load.
Non-Functional Requirements

Mobile-first performance.
Fast startup and low bundle size.
Stable 60fps target on common devices, graceful degrade if lower.
Accessibility:
Keyboard navigation
Readable modal content
Sufficient contrast
Security:
Input validation
Sanitized rich text
Safe outbound links
Reliability:
Autosave in editor
No data loss on refresh
Data Model (Conceptual)

User
id
handle
profile fields
World
id
ownerId
width/height
draftData
publishedData
updatedAt
TileLayer
worldId
layer name
tile matrix / compressed tile array
Object
id
worldId
type
x/y grid position
payload (text/link/media)
interaction settings
PublishRecord
worldId
version
publishedAt
rollback target
AnalyticsEvent
worldId
eventType
objectId optional
timestamp
device metadata
User Flows

Creator flow:
Sign in
Create world
Place tiles/objects
Preview
Publish
Share URL
Visitor flow:
Open URL
Spawn into world
Move around
Interact with objects
Open links or read content
Update flow:
Creator edits draft
Republishes
Visitors always see latest published snapshot
Editor Scope

Brush tool for tiles.
Eraser tool.
Layer toggle visibility.
Object placement and property panel.
Basic undo/redo.
Snap-to-grid always on.
Save state indicator.
Publish button with confirmation.
Runtime Scope

Character movement.
Camera follow within map bounds.
Tile collision.
Interaction radius or direct click/tap interaction.
UI modal system for content.
Link open behavior with safe target handling.
Simple loading screen.
Performance Budget Direction

Keep world small in V1.
Limit simultaneous animated sprites.
Use compressed atlases/spritesheets.
Lazy-load editor separately from visitor runtime.
Cache static assets at CDN edge.
Minimize re-renders in overlay UI.
Avoid heavy effects and post-processing.
Security & Trust

Sanitize all creator text content.
Validate and normalize outbound URLs.
Rate-limit publish/update actions.
Basic abuse reporting.
Optional allowlist/denylist for risky domains later.
Testing Scope

Unit tests:
Collision logic
Object trigger logic
Data validation
Integration tests:
Save/publish pipeline
Draft vs published separation
E2E tests:
Creator builds and publishes map
Visitor roams and opens interactions on mobile and desktop
Milestones

Milestone 1: Core runtime prototype
Grid render
Movement
Collision
One interaction type
Milestone 2: Creator editor MVP
Tile/object placement
Save/load
Preview
Milestone 3: Publish + public URLs
Draft/published states
Shareable pages
Basic analytics
Milestone 4: Polish for launch
Mobile controls
Performance tuning
QA + bug fixing
Definition Of Done (V1)

Creator can build and publish one world in under 10 minutes.
Visitor on mobile can load, move, and interact without confusion.
No critical data-loss or publish corruption bugs.
Public worlds load quickly and consistently.
Core analytics events are recorded accurately.
Risks

Scope creep into “full game platform.”
Performance regressions from oversized assets.
Editor complexity growing too fast.
Content moderation overhead.
Risk Mitigation

Freeze V1 feature list.
Enforce world/object limits.
Keep interaction types minimal.
Add moderation basics early.
Copy-Paste Brief For New Chat