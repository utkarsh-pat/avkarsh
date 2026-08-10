# ADR-009: Unified Actors with Scoped Guest Identity

Status: Accepted  
Date: 2026-08-10

## Context

Management users authenticate with Google, operational staff may exist only on hotel devices, and guests use short-lived stay verification. Business/audit records need one actor vocabulary without granting identical identity lifetime or privileges.

## Decision

Use `actors` for auditable management, operational staff and platform principals. Management `profiles` link Supabase Auth users; `staff_members` and `staff_pin_credentials` remain property scoped. Device sessions authorize devices, not credentials. Guest actions use a scoped actor reference owned by `guest_portal_sessions`, bound to one stay and expiry; guests are not permanent management-style actors.

## Consequences

Audit references become consistent while credential and retention models remain correct. Business tables use actor references where accountability is needed and separately retain domain guest/stay references.

## Acceptance

Staff actions are attributable without Google accounts; revoked devices reject PIN use; guest actor cannot cross stay/property or reveal shared-room occupants; guest-session retention can expire without corrupting permanent management/staff audit history.
