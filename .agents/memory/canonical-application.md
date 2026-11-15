---
name: Canonical application
description: User decision about the repository root when integrating the GitHub and Replit applications.
---

The Replit workspace is the canonical application at the GitHub repository root. Preserve the older standalone Next.js source separately rather than allowing its build configuration to control Sparky.

**Why:** The user explicitly chose “Replit workspace” when asked which app should be canonical at GitHub's root. Mixing the two applications' root configuration broke workspace installation and styling.

**How to apply:** Keep archived Next.js dependencies and configuration outside workspace installation and configuration discovery. Do not treat the old Vercel setup as a deployment configuration for Sparky.
