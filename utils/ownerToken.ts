"use client";

const OWNER_TOKEN_KEY = "myboard_owner_token";

export function getOrCreateOwnerToken(): string {
  if (typeof window === "undefined") {
    return "server-owner-token";
  }
  const existing = localStorage.getItem(OWNER_TOKEN_KEY);
  if (existing && existing.trim()) {
    return existing;
  }
  const created = crypto.randomUUID();
  localStorage.setItem(OWNER_TOKEN_KEY, created);
  return created;
}
