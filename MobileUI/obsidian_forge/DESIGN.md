# Design System Document: Art & Expense Management

## 1. Overview & Creative North Star
**The Creative North Star: "The Obsidian Ledger"**

This design system is built to transform utilitarian financial tracking into a premium, editorial experience. In the high-stakes world of art production, users don't just need a tool; they need a sophisticated dashboard that feels authoritative yet effortless. 

By rejecting the "template" look of standard enterprise apps, this system utilizes **Obsidian Layering**—a philosophy where depth is created through shifting tonal values of black and charcoal rather than traditional lines. The layout embraces intentional asymmetry and a dramatic typography scale to draw the eye to high-value metrics, ensuring the mobile experience feels like a custom-tailored financial report rather than a generic spreadsheet.

---

## 2. Colors
Our palette is rooted in a "Deep Dark" philosophy. We use a range of near-blacks to create a sense of infinite depth, punctuated by high-energy accents.

### Palette Highlights
- **Surface Foundations:** `background: #0e0e0e` (Deep Charcoal) and `surface_container_lowest: #000000` (Pure Black).
- **The Primary Heat:** `primary: #ff9159` and `primary_fixed_dim: #f66700`. This vivid orange acts as a beacon for action and brand identity.
- **Semantic Feedback:** `error: #ff7351` for budget overages and mismatches; `tertiary: #ffc562` for warnings or status-pending items.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section content. 
Boundaries must be defined solely through background color shifts. For example, a `surface_container_high` card should sit directly on a `surface` background. The change in hex value is the border. This creates a seamless, high-end feel that reduces visual noise and cognitive load on mobile screens.

### Glassmorphism & Signature Textures
To add "soul" to the digital interface:
- **Floating Actions:** Bottom-fixed actions and sticky headers should utilize `surface_variant` with a 60% opacity and a `20px` backdrop-blur. 
- **The Radiant CTA:** Major buttons should not be flat. Use a subtle linear gradient from `primary` (#ff9159) to `primary_container` (#ff7a2f) at a 135-degree angle to give the element a physical, tactile presence.

---

## 3. Typography
The system uses a dual-font strategy to balance editorial flair with technical precision.

- **The Voice (Manrope):** Used for `display` and `headline` levels. Its geometric yet warm curves provide an "Art Director" persona to the app. 
- **The Engine (Inter):** Used for `title`, `body`, and `labels`. Inter is chosen for its extreme legibility at small sizes and its neutral, "pro" feel.
- **Currency & Metrics:** All financial figures must use `headline-lg` or `display-sm` with **Bold** weighting. Large-scale numbers are the primary visual anchor of the system.

---

## 4. Elevation & Depth
In a dark theme, shadows are often invisible. We achieve hierarchy through **Tonal Layering** and **Ambient Glows**.

### The Layering Principle
Hierarchy is achieved by "stacking" surface tiers. 
- **Level 0 (Background):** `#0e0e0e`
- **Level 1 (Sections):** `surface_container_low` (#131313)
- **Level 2 (Cards):** `surface_container` (#1a1a1a)
- **Level 3 (Pop-overs):** `surface_container_highest` (#262626)

### Ambient Shadows
When a card needs to "float" (e.g., a modal or a primary action button), use a shadow tinted with the primary orange or surface-on-color.
- **Shadow Spec:** `0px 12px 32px rgba(0, 0, 0, 0.5)` with an additional `0px 4px 8px rgba(255, 145, 89, 0.04)` to mimic light bouncing off the orange accents.

### The "Ghost Border" Fallback
If a separation is technically required for accessibility, use a **Ghost Border**: `outline_variant` (#484847) at **15% opacity**. Never use 100% opaque lines.

---

## 5. Components

### Cards & Lists
Cards must use `roundedness-xl` (1.5rem). 
- **Rule:** Forbid the use of divider lines between list items. Use vertical white space (16px or 24px) or a subtle shift to `surface_container_low` for alternating rows to separate content. 
- **Mobile optimization:** All cards should have a minimum height of 88px to ensure they are easily tappable.

### Buttons (Optimized for One-Handed Use)
- **Primary Action:** Large, full-width buttons fixed to the bottom of the viewport. Use `primary` background with `on_primary_fixed` (Black) text for maximum contrast.
- **Secondary Action:** `outline` style using the Ghost Border technique.
- **Large Touch Targets:** Every interactive element must maintain a minimum 44x44pt tap area, even if the visual element is smaller.

### Input Fields
Text inputs should feel like integrated parts of the surface.
- **Style:** Use `surface_container_highest` as the input background. No bottom line; only a change in surface color.
- **States:** On focus, the background shifts to `surface_bright` with a 1px `primary` ghost border.

### Production Chips
Used for status (e.g., "Verified," "Flagged").
- **Styling:** Small `label-sm` text with high letter spacing (0.05em). Backgrounds should be low-saturation versions of the status color (e.g., a deep forest green for "Verified") to keep the focus on the data.

---

## 6. Do's and Don'ts

### Do
- **Do** use aggressive scale differences between currency amounts and their descriptive labels (e.g., a 32pt price next to a 12pt "Materials" label).
- **Do** utilize "Dead Zones." On mobile, keep the top 15% of the screen for status and titles, and the bottom 25% for high-frequency actions.
- **Do** use the `primary` orange sparingly as a "heat map" to guide the user toward the most important action on the page.

### Don't
- **Don't** use pure white (#FFFFFF) for body text. Use `on_surface_variant` (#adaaaa) to reduce eye strain in dark mode. Pure white is reserved for high-level headlines.
- **Don't** use standard "drop shadows." They look muddy on deep charcoal backgrounds. Use surface color shifts instead.
- **Don't** use icons without labels unless they are universally understood (e.g., a plus sign for "Add"). Production terminology is specific; clarity beats minimalism.

---
*This system is designed to be felt as much as it is seen—a tool that mirrors the premium nature of the art it tracks.*