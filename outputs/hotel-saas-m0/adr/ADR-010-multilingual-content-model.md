# ADR-010: Multilingual UI and Typed Content Translations

Status: Accepted  
Date: 2026-08-10

## Decision

Launch catalogs: Hindi, English, French, Spanish, German and Russian. Optional property packs: Japanese, Thai, Sinhala and Korean. Static application strings are version-controlled. Database content uses typed translation tables with parent foreign keys and unique `(parent_id, locale)`. Resolution: platform default → organization override → property override → English fallback. Runtime machine translation is excluded from MVP.

## Rationale

Typed tables preserve foreign keys/RLS and allow field-specific validation. A generic polymorphic translation table is rejected because it weakens referential integrity and complicates tenant authorization.

Translation rows use publication states `draft`, `reviewed`, `published`, `archived` plus `source_locale`, `translation_version`, `reviewed_by_actor_id`, `reviewed_at` and `content_hash`. Guest-facing resolution and English fallback use only published content; unfinished translations are never exposed.

## Acceptance

Every enabled locale passes publication/fallback, missing-key, long-text, glyph, date/number and 320/360/390/430 px tests. WhatsApp templates send only provider-approved locale variants.
