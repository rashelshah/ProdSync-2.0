# Design System: Monochrome Precision

## 1. Overview & Creative North Star: "The Cinematic Negative"
This design system is a tribute to the craft of filmmaking—specifically the clarity and contrast of a black-and-white master print. Our Creative North Star is **"The Cinematic Negative."** 

In film, every frame is an intentional composition of light and shadow. This system moves away from "generic dark mode" by treating the UI as a physical space of obsidian surfaces. We break the "template" look through **intentional asymmetry** and **tonal depth**. Large, cinematic display type creates an editorial feel, while the meticulous layering of grays replaces the need for distracting structural lines. We are not just building a tool; we are building a viewfinder for production management.

---

## 2. Colors: The Obsidian Spectrum
Our palette is a disciplined range of monochrome tones designed to guide the eye through luminance rather than hue.

### Surface Hierarchy & Nesting
To achieve a high-end feel, we follow the **Layering Principle**. Depth is created by stacking tones. 
- **The "No-Line" Rule:** Prohibit 1px solid borders for sectioning large layout blocks. Boundaries must be defined by shifts in background color. For example, a `surface-container-low` sidebar sitting against a `surface` main content area.
- **Surface Tiers:**
    - `surface-container-lowest` (#0e0e0e): Use for the base background or "void" areas.
    - `surface` (#131313): The standard working surface.
    - `surface-container-high` (#2a2a2a): For elevated interactive elements like cards.
- **The "Glass & Texture" Rule:** For floating modals or navigation overlays, use `surface` at 80% opacity with a `24px` backdrop-blur. This "frosted obsidian" effect ensures the UI feels integrated and premium.

| Token | Hex | Usage |
| :--- | :--- | :--- |
| `primary` | #ffffff | Primary actions, high-contrast text. |
| `surface` | #131313 | Base application background. |
| `on_surface` | #e5e2e1 | Standard body text and icons. |
| `outline_variant` | #474747 | Low-impact borders (Ghost Borders). |
| `error` | #ffb4ab | Critical alerts (use sparingly). |

---

## 3. Typography: Editorial Authority
We use **Inter** exclusively. The weight and scale are used to mimic a film's title card or a professional script.

- **Display (Large/Med/Small):** Used for "Hero" moments—project titles or production phases. Use `Tight` letter spacing (-0.02em) to give it a modern, tech-forward edge.
- **Headlines & Titles:** Bold and unapologetic. Use these to anchor sections.
- **Body & Labels:** Functional and legible. `body-md` (0.875rem) is our workhorse for production data.

**Editorial Hierarchy:** Pair a `display-md` project title with a `label-sm` metadata tag (uppercase with 0.1em tracking) to create a high-contrast, premium aesthetic.

---

## 4. Elevation & Depth: Tonal Layering
Traditional shadows and bright borders feel "cheap." We achieve sophistication through light physics.

- **Ambient Shadows:** When a floating effect is required (e.g., a dropdown menu), use an extra-diffused shadow: `0px 20px 40px rgba(0, 0, 0, 0.4)`. The shadow should feel like a soft occlusion of light, never a harsh drop-shadow.
- **The "Ghost Border":** If a container requires a border for accessibility, use the `outline_variant` (#474747) at **20% opacity**. This creates a "barely-there" definition that guides the eye without cluttering the frame.
- **Inner Glow (The Precision Edge):** For primary buttons or active states, use a 1px top-inner-border of `white` at 10% opacity. This mimics how light catches the edge of high-end camera equipment.

---

## 5. Components: Precision Tools

### Buttons
- **Primary:** Background `primary` (#ffffff), Text `on_primary` (#1a1c1c). Hard 4px corners. No shadow.
- **Secondary:** Background `surface-container-high`, Ghost Border.
- **States:** On hover, primary buttons should shift to `primary-container` (#d4d4d4). Never use color transitions; only luminance shifts.

### Cards & Lists
- **Forbid Dividers:** Do not use lines to separate list items. Use 12px–16px of vertical whitespace or a subtle background hover state (`surface-bright`).
- **Cards:** Use `surface-container-low` on a `surface` background. The change in tone is the boundary.

### Input Fields
- **Default:** Background `surface-container-lowest`, 1px Ghost Border.
- **Focus:** Border becomes `primary` (#ffffff) at 100% opacity. No "blue" focus rings.
- **Error:** Use `error` (#ffb4ab) for the text label and a subtle 1px border.

### Film-Specific Components
- **The Playhead/Timeline:** Use a 1px `primary` line for the playhead. Background tracks should use `surface-container-highest` to differentiate from the main background.
- **Scene Strips:** Use `secondary-container` for unselected scenes and `primary` for the active scene.

---

## 6. Do’s and Don'ts

### Do:
- **Use "Space as Structure":** Lean on the spacing scale to separate ideas.
- **Monochrome-First:** Every piece of information should be legible in pure B&W before considering the `error` red.
- **Intentional Asymmetry:** Align large text to the left and functional data to the right to create a sophisticated, non-grid feel.

### Don't:
- **No 100% Opaque Borders:** Avoid "boxing" the user in. Use tonal shifts instead.
- **No Glows:** Avoid "neon" effects or outer glows. We are aiming for precision, not "gamer" aesthetics.
- **No Rounded Corners > 4px:** Stay sharp. Rounded corners (lg/xl) should only be used for avatar circles or specific status chips; buttons and cards must remain `md` (4px) or `sm` (2px).

### Director's Closing Note:
Precision is the absence of noise. Every pixel in this system should serve a purpose. If a border doesn't need to be there, remove it. Let the typography and the deep obsidian surfaces do the talking.