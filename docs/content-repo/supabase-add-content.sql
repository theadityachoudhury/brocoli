-- Phase 1: Add content column to posts table
-- Run this in Supabase SQL editor BEFORE deploying the new frontend

alter table posts add column if not exists content text;

-- Existing rows will have content = NULL until migrate-content.ts is run
