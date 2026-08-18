# Imported Source Manifest

**Status:** Current provenance register; self-attested official-PDF origin, URL/capture metadata unavailable
**Owner:** System role `academic_lead` or `admin`
**Last checked:** 2026-08-18

This manifest is the sole owner of provenance, checksum and verification status for imported curriculum evidence. Imported files are read-only evidence, not editable product contracts or learner-facing content. A checksum mismatch is a blocking integrity finding; a source discrepancy or citation gap is an academic finding and must not be silently repaired from another edition.

| File | Edition / provenance | Authority rank | SHA-256 | Verification status |
| --- | --- | --- | --- | --- |
| `cambridge-young-learners-wordlist-2025.md` | Cambridge English *Pre A1 Starters, A1 Movers and A2 Flyers Word List*, 2025 edition; imported Markdown export | Current working curriculum reference | `f9c0b4a378b7bc7911adaaa3ccec81e1cd2064fd65b1aeb919cc1fd8ec811fb5` | **Self-attested:** converted from an official Cambridge PDF; original URL, acquisition date and conversion method were not retained. Not independently verified for public claims (`GATE-ACADEMIC-SOURCES`). |
| `cambridge-young-learners-handbook.md` | Cambridge English *Young Learners Teacher Handbook*, 2024 edition; imported Markdown export | Current working assessment-format evidence, subordinate to approved product contracts | `48f514ae85f4abb20ffbee8790b7e4fb67cc7ce9e367f02320d5c55017bbd4d8` | **Self-attested:** converted from an official Cambridge PDF; original URL, acquisition date and conversion method were not retained. Not independently verified for public claims (`GATE-ACADEMIC-SOURCES`). |
| `cambridge-young-learners-wordlist.md` | Cambridge English word list labelled “for exams from 2018”; imported Markdown export | Historical reference only | `36c3792804825ee5e52eb3f5ff872a9553cc2b3d24ce0d0adeb2ad057d2a90e4` | **Historical; do not use to fill 2025 gaps.** Self-attested official-PDF origin; original URL, acquisition date and conversion method were not retained. |

## Verification protocol

The user has attested that all three exports were converted from official Cambridge PDFs. An `academic_lead` or `admin` must still record the official publisher URL, acquisition date, conversion/export method, citation locations used by the blueprint, and any discrepancy between the imported export and official source before closing `GATE-ACADEMIC-SOURCES`. Until then the 2025 edition is a working reference only and no public curriculum/alignment claim may rely on it.

Never edit, rename or delete the three imported files without owner approval. Update this manifest only after byte-level comparison and academic review; do not normalise whitespace or line endings in the source exports.
