# ADR-012: Secure Invitations and Account Recovery

Status: Accepted  
Date: 2026-08-10

## Decision

Owner/partner/manager invite tokens are single-use/expiring but Google claim alone does not activate membership. The inviter or required approver confirms the claimed Google identity. Operational staff use manager-supervised device enrollment.

Normal Google access uses normal login. Lost-access recovery requires another verified owner when available. Sole-owner recovery is a platform case with business verification, independent approval, cooling period, notices, ownership/billing lock and complete session/device revocation. Support cannot directly replace an owner outside the case workflow.

## Acceptance

Forwarded high-privilege links remain pending; case evidence is safely referenced; unapproved/cooling cases cannot mutate ownership/billing; completion revokes prior sessions and produces canonical audit events.
