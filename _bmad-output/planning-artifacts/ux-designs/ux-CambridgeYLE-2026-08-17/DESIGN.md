---
name: CambridgeYLE
description: A calm, child-friendly P0 practice workspace that makes focused English practice clear for learners and evidence legible for teachers.
status: current-with-open-gates
sources:
  - ../../prds/prd-CambridgeYLE-2026-08-17/prd.md
  - ../../../../docs/starters-curriculum-and-assessment-blueprint.md
updated: 2026-08-18
colors:
  surface-base: '#F7FAF7'
  surface-raised: '#FFFFFF'
  surface-soft: '#EAF4EF'
  ink-primary: '#19332B'
  ink-secondary: '#52655E'
  ink-disabled: '#8A9A94'
  primary: '#176B4D'
  primary-foreground: '#FFFFFF'
  secondary: '#2B6CB0'
  secondary-foreground: '#FFFFFF'
  focus: '#8A5200'
  positive: '#287D57'
  caution: '#A96612'
  danger: '#B63A3A'
  border: '#CFE0D7'
  border-strong: '#92B5A4'
typography:
  display:
    fontFamily: 'Nunito Sans, system-ui, sans-serif'
    fontSize: 28px
    fontWeight: '800'
    lineHeight: '1.2'
  heading:
    fontFamily: 'Nunito Sans, system-ui, sans-serif'
    fontSize: 22px
    fontWeight: '800'
    lineHeight: '1.25'
  body:
    fontFamily: 'Atkinson Hyperlegible, system-ui, sans-serif'
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: 'Atkinson Hyperlegible, system-ui, sans-serif'
    fontSize: 16px
    fontWeight: '700'
    lineHeight: '1.35'
  meta:
    fontFamily: 'Atkinson Hyperlegible, system-ui, sans-serif'
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
rounded:
  sm: 8px
  md: 12px
  lg: 18px
  xl: 24px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
  gutter-mobile: 16px
  gutter-desktop: 32px
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
    minHeight: 48px
  answer-option:
    background: '{colors.surface-raised}'
    border: '{colors.border-strong}'
    radius: '{rounded.lg}'
    minHeight: 56px
  evidence-state:
    secure: '{colors.positive}'
    building: '{colors.secondary}'
    needs-practice: '{colors.caution}'
    not-assessed: '{colors.ink-secondary}'
---

# CambridgeYLE Design Spine

> `DESIGN.md` owns visual rules only. Product decisions and gates remain in the PRD; the current unbranded direction remains an assumption under `DEC-BRAND`.

## Brand & Style

CambridgeYLE is a quiet practice room, not a game arcade and not a high-stakes exam portal. The learner should feel that the next question is understandable and achievable; the teacher should feel that the evidence is orderly and dependable. Use friendly illustration space and direct language, while letting questions, audio, and pictures remain the centre of attention.

This is an initial visual direction, marked as an assumption until centre brand assets are supplied. It must not resemble Cambridge assessment material or use Cambridge marks, shields, certificates, or result language.

## Colours

- **Soft green surfaces** `{colors.surface-base}` and `{colors.surface-soft}` make a long practice flow calm without competing with learning media.
- **Deep green primary** `{colors.primary}` denotes the main forward action, including starting and submitting a set. It is not a correctness indicator.
- **Blue** `{colors.secondary}` supports neutral information, such as audio preparation and `building` evidence. It does not mean a learner is right or wrong.
- **Deep amber** `{colors.focus}` provides a visible focus indicator against adjacent light surfaces and supports attention; it is never the sole carrier of meaning or paired with language that could shame a child. `needs practice` uses the separate `{colors.caution}` semantic token.
- **Green positive** `{colors.positive}` is reserved for post-submission correct-answer comparison and `secure` evidence. **Red** `{colors.danger}` is reserved for destructive admin actions and errors, never a learner's wrong answer.

## Typography

Use the generous, high-legibility `{typography.body}` face for all learner text, form controls, and answer input. Instructions should be short and appear one thought at a time. Headings use `{typography.heading}`; display text is limited to result and empty-state headings. Do not use all caps, condensed type, or instructional text below `{typography.meta}`.

## Layout & Spacing

The learner experience is a single column with `{spacing.gutter-mobile}` margins. Questions occupy one visual task at a time. An image, scene, or audio control sits above the response control, followed by a fixed bottom action area when needed. Desktop preserves this focused central column instead of stretching questions across the screen.

Teacher, admin, and editor surfaces use a responsive content frame with `{spacing.gutter-desktop}` margins. Tables collapse into labelled rows or cards at narrow widths. The minimum touch target is 48 by 48 CSS pixels.

## Elevation & Depth

Use tonal separation and a 1px `{colors.border}` border for cards, answer options, and panels. Shadows are subtle and reserved for a bottom action bar, menu, dialog, or a dragged card. Do not use elevated cards to create a game-board effect.

## Shapes

Use `{rounded.lg}` for answer options, media cards, and learning surfaces. Use `{rounded.md}` for buttons, fields, and dashboard cards. Status badges may use `{rounded.full}` but must always include text. Avoid excessive pills, bubbles, stickers, progress stars, or trophy-like shapes.

## Components

- **Practice header:** task name, question position, optional exit action, and a text progress indicator such as `Question 3 of 5`. No score appears before submission.
- **Answer option:** a large, entire-row touch target. Selected state adds a strong outline and a textual selected state for assistive technology; colour alone never carries selection.
- **Audio control:** clear play/replay button and transcript unavailable to learners when it reveals the answer. P0 replay is unlimited, so no remaining-replays count appears.
- **Result evidence card:** always uses product-owned labels: `secure`, `building`, `needs practice`, or `not assessed yet`. It never displays pass/fail, a certificate, shield, or an official score.
- **Deactivation dialog:** account deactivation uses `{colors.danger}`, explains access revocation and P0 record retention, and requires an explicit named confirmation. It never implies deletion or purge and never appears in learner flows.

## Do's and Don'ts

| Do | Don't |
| --- | --- |
| Make one question and one response action visually dominant | Put competing tips, score widgets, or unrelated recommendations beside a question; recommendations belong before a set starts |
| Use original, accessible learning media | Recreate or closely imitate protected Cambridge pages, illustrations, scripts, or layouts |
| Reserve correctness styling for after submission | Reveal right/wrong feedback while a practice set is in progress |
| Pair every state colour with a plain-language label | Depend on colour, icons, or facial expressions alone |
| Use calm progress language such as `Continue` and `Review answers` | Use streaks, rankings, confetti, trophies, or pass/fail language |
