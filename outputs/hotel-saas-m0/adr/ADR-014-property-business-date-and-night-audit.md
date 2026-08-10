# ADR-014: Property Business Date and Night Audit

Status: Proposed for decision before M2/M3  
Date: 2026-08-10

## Context

Hotel shifts, stays and cash operations cross midnight. UTC instants and local calendar dates alone do not consistently describe the property's operating day.

## Decision

Store instants as UTC `timestamptz`, stay nights as property-local half-open dates and material operational/financial records with explicit `business_date` derived by a versioned property night-audit/cutoff policy. Never infer historical business date later from a changed timezone/cutoff.

## Acceptance

Tests cover overnight shifts, late checkout, timezone changes, DST properties, rate/tax effective dates, invoice fiscal dates and night-audit close/reopen behavior.

