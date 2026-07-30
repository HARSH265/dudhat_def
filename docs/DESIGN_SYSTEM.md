# Design System

## Design Freeze

The existing visual design is **approved and frozen**.

Do not change:
- Layout, spacing, or composition of any existing page
- Colour palette, typography, logo, or tagline
- Component appearance (Navbar, Footer, Hero, Product Card, Feature Card, CTA banner, form)
- Copy tone or brand language

Permitted without approval:
- Responsive behaviour fixes (a broken layout at a given width is a defect, not a design)
- Accessibility fixes (labels, focus states, contrast, ARIA)
- Performance work that does not alter rendered output
- Internal refactoring that is visually identical

Requires design approval before build:
- Any new page (e.g. product detail)
- Any new UI element (e.g. floating CTA, extra button)
- Any change to an existing component's rendered appearance

Applies to the public site (`client/`) only. The admin panel is a new surface with its own conventions — see [ADMIN_PANEL_SPECIFICATION.md](ADMIN_PANEL_SPECIFICATION.md) §2.

## Design Personality
- Corporate
- Industrial
- Premium
- Trustworthy

## Responsive Strategy

Target: **Mobile First**

Current state: **desktop-first**. All 9 media queries in `client/src/App.css` use `max-width`, across 6 inconsistent breakpoints (1200, 992, 900, 800, 600, 500) with no system. Two `!important` overrides exist at `App.css:551` and `App.css:599`. Container width is inconsistent: `.container` is 1300px, navbar and footer are 1400px.

### Canonical breakpoints

Use these values only. Mobile-first (`min-width`) for all new and refactored CSS.

| Token | Width | Target |
|---|---|---|
| base | 0 | Mobile portrait |
| `sm` | 640px | Mobile landscape |
| `md` | 768px | Tablet |
| `lg` | 1024px | Laptop |
| `xl` | 1280px | Desktop |

Container max-width: **1300px**, single value, everywhere.

Minimum supported viewport: **320px**.

Existing `max-width` queries are migrated to this scale component by component, with a visual diff check per component. The rendered result at every breakpoint must be unchanged — this is a defect fix and a maintainability change, not a redesign.

## Components
- Navbar
- Footer
- Hero
- Product Card
- CTA Section
- Inquiry Form
- Gallery

## Animation Rules
- Fast
- Smooth
- Professional

Avoid:
- Flashy effects
- Excessive motion

## UI Rules
- Consistent spacing
- Consistent typography
- Consistent buttons
- Reusable components only