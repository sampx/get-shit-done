# WSF Command Reference

> Complete command syntax, flags, options, and examples. For feature details, see [Feature Reference](FEATURES.md). For workflow walkthroughs, see [User Guide](USER-GUIDE.md).

---

## Command Syntax

- **Claude Code / Gemini / Copilot:** `/wsf-command-name [args]`
- **OpenCode / Kilo:** `/wsf-command-name [args]`
- **Codex:** `$wsf-command-name [args]`

---

## Core Workflow Commands

### `/wsf-new-project`

Initialize a new project with deep context gathering.

| Flag | Description |
|------|-------------|
| `--auto @file.md` | Auto-extract from document, skip interactive questions |

**Prerequisites:** No existing `.planning/PROJECT.md`
**Produces:** `PROJECT.md`, `REQUIREMENTS.md`, `ROADMAP.md`, `STATE.md`, `config.json`, `research/`, `CLAUDE.md`

```bash
/wsf-new-project                    # Interactive mode
/wsf-new-project --auto @prd.md     # Auto-extract from PRD
```

---

### `/wsf-new-workspace`

Create an isolated workspace with repo copies and independent `.planning/` directory.

| Flag | Description |
|------|-------------|
| `--name <name>` | Workspace name (required) |
| `--repos repo1,repo2` | Comma-separated repo paths or names |
| `--path /target` | Target directory (default: `~/wsf-workspaces/<name>`) |
| `--strategy worktree\|clone` | Copy strategy (default: `worktree`) |
| `--branch <name>` | Branch to checkout (default: `workspace/<name>`) |
| `--auto` | Skip interactive questions |

**Use cases:**
- Multi-repo: work on a subset of repos with isolated WSF state
- Feature isolation: `--repos .` creates a worktree of the current repo

**Produces:** `WORKSPACE.md`, `.planning/`, repo copies (worktrees or clones)

```bash
/wsf-new-workspace --name feature-b --repos hr-ui,ZeymoAPI
/wsf-new-workspace --name feature-b --repos . --strategy worktree  # Same-repo isolation
/wsf-new-workspace --name spike --repos api,web --strategy clone   # Full clones
```

---

### `/wsf-list-workspaces`

List active WSF workspaces and their status.

**Scans:** `~/wsf-workspaces/` for `WORKSPACE.md` manifests
**Shows:** Name, repo count, strategy, WSF project status

```bash
/wsf-list-workspaces
```

---

### `/wsf-remove-workspace`

Remove a workspace and clean up git worktrees.

| Argument | Required | Description |
|----------|----------|-------------|
| `<name>` | Yes | Workspace name to remove |

**Safety:** Refuses removal if any repo has uncommitted changes. Requires name confirmation.

```bash
/wsf-remove-workspace feature-b
```

---

### `/wsf-discuss-phase`

Capture implementation decisions before planning.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to current phase) |

| Flag | Description |
|------|-------------|
| `--auto` | Auto-select recommended defaults for all questions |
| `--batch` | Group questions for batch intake instead of one-by-one |
| `--analyze` | Add trade-off analysis during discussion |
| `--power` | File-based bulk question answering from a prepared answers file |

**Prerequisites:** `.planning/ROADMAP.md` exists
**Produces:** `{phase}-CONTEXT.md`, `{phase}-DISCUSSION-LOG.md` (audit trail)

```bash
/wsf-discuss-phase 1                # Interactive discussion for phase 1
/wsf-discuss-phase 3 --auto         # Auto-select defaults for phase 3
/wsf-discuss-phase --batch          # Batch mode for current phase
/wsf-discuss-phase 2 --analyze      # Discussion with trade-off analysis
/wsf-discuss-phase 1 --power        # Bulk answers from file
```

---

### `/wsf-ui-phase`

Generate UI design contract for frontend phases.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to current phase) |

**Prerequisites:** `.planning/ROADMAP.md` exists, phase has frontend/UI work
**Produces:** `{phase}-UI-SPEC.md`

```bash
/wsf-ui-phase 2                     # Design contract for phase 2
```

---

### `/wsf-plan-phase`

Research, plan, and verify a phase.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to next unplanned phase) |

| Flag | Description |
|------|-------------|
| `--auto` | Skip interactive confirmations |
| `--research` | Force re-research even if RESEARCH.md exists |
| `--skip-research` | Skip domain research step |
| `--gaps` | Gap closure mode (reads VERIFICATION.md, skips research) |
| `--skip-verify` | Skip plan checker verification loop |
| `--prd <file>` | Use a PRD file instead of discuss-phase for context |
| `--reviews` | Replan with cross-AI review feedback from REVIEWS.md |
| `--validate` | Run state validation before planning begins |

**Prerequisites:** `.planning/ROADMAP.md` exists
**Produces:** `{phase}-RESEARCH.md`, `{phase}-{N}-PLAN.md`, `{phase}-VALIDATION.md`

```bash
/wsf-plan-phase 1                   # Research + plan + verify phase 1
/wsf-plan-phase 3 --skip-research   # Plan without research (familiar domain)
/wsf-plan-phase --auto              # Non-interactive planning
/wsf-plan-phase 2 --validate        # Validate state before planning
```

---

### `/wsf-execute-phase`

Execute all plans in a phase with wave-based parallelization, or run a specific wave.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | **Yes** | Phase number to execute |
| `--wave N` | No | Execute only Wave `N` in the phase |
| `--validate` | No | Run state validation before execution begins |

**Prerequisites:** Phase has PLAN.md files
**Produces:** per-plan `{phase}-{N}-SUMMARY.md`, git commits, and `{phase}-VERIFICATION.md` when the phase is fully complete

```bash
/wsf-execute-phase 1                # Execute phase 1
/wsf-execute-phase 1 --wave 2       # Execute only Wave 2
/wsf-execute-phase 1 --validate     # Validate state before execution
```

---

### `/wsf-verify-work`

User acceptance testing with auto-diagnosis.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to last executed phase) |

**Prerequisites:** Phase has been executed
**Produces:** `{phase}-UAT.md`, fix plans if issues found

```bash
/wsf-verify-work 1                  # UAT for phase 1
```

---

### `/wsf-next`

Automatically advance to the next logical workflow step. Reads project state and runs the appropriate command.

**Prerequisites:** `.planning/` directory exists
**Behavior:**
- No project → suggests `/wsf-new-project`
- Phase needs discussion → runs `/wsf-discuss-phase`
- Phase needs planning → runs `/wsf-plan-phase`
- Phase needs execution → runs `/wsf-execute-phase`
- Phase needs verification → runs `/wsf-verify-work`
- All phases complete → suggests `/wsf-complete-milestone`

```bash
/wsf-next                           # Auto-detect and run next step
```

---

### `/wsf-session-report`

Generate a session report with work summary, outcomes, and estimated resource usage.

**Prerequisites:** Active project with recent work
**Produces:** `.planning/reports/SESSION_REPORT.md`

```bash
/wsf-session-report                 # Generate post-session summary
```

**Report includes:**
- Work performed (commits, plans executed, phases progressed)
- Outcomes and deliverables
- Blockers and decisions made
- Estimated token/cost usage
- Next steps recommendation

---

### `/wsf-ship`

Create PR from completed phase work with auto-generated body.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number or milestone version (e.g., `4` or `v1.0`) |
| `--draft` | No | Create as draft PR |

**Prerequisites:** Phase verified (`/wsf-verify-work` passed), `gh` CLI installed and authenticated
**Produces:** GitHub PR with rich body from planning artifacts, STATE.md updated

```bash
/wsf-ship 4                         # Ship phase 4
/wsf-ship 4 --draft                 # Ship as draft PR
```

**PR body includes:**
- Phase goal from ROADMAP.md
- Changes summary from SUMMARY.md files
- Requirements addressed (REQ-IDs)
- Verification status
- Key decisions

---

### `/wsf-ui-review`

Retroactive 6-pillar visual audit of implemented frontend.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number (defaults to last executed phase) |

**Prerequisites:** Project has frontend code (works standalone, no WSF project needed)
**Produces:** `{phase}-UI-REVIEW.md`, screenshots in `.planning/ui-reviews/`

```bash
/wsf-ui-review                      # Audit current phase
/wsf-ui-review 3                    # Audit phase 3
```

---

### `/wsf-audit-uat`

Cross-phase audit of all outstanding UAT and verification items.

**Prerequisites:** At least one phase has been executed with UAT or verification
**Produces:** Categorized audit report with human test plan

```bash
/wsf-audit-uat
```

---

### `/wsf-audit-milestone`

Verify milestone met its definition of done.

**Prerequisites:** All phases executed
**Produces:** Audit report with gap analysis

```bash
/wsf-audit-milestone
```

---

### `/wsf-complete-milestone`

Archive milestone, tag release.

**Prerequisites:** Milestone audit complete (recommended)
**Produces:** `MILESTONES.md` entry, git tag

```bash
/wsf-complete-milestone
```

---

### `/wsf-milestone-summary`

Generate comprehensive project summary from milestone artifacts for team onboarding and review.

| Argument | Required | Description |
|----------|----------|-------------|
| `version` | No | Milestone version (defaults to current/latest milestone) |

**Prerequisites:** At least one completed or in-progress milestone
**Produces:** `.planning/reports/MILESTONE_SUMMARY-v{version}.md`

**Summary includes:**
- Overview, architecture decisions, phase-by-phase breakdown
- Key decisions and trade-offs
- Requirements coverage
- Tech debt and deferred items
- Getting started guide for new team members
- Interactive Q&A offered after generation

```bash
/wsf-milestone-summary                # Summarize current milestone
/wsf-milestone-summary v1.0           # Summarize specific milestone
```

---

### `/wsf-new-milestone`

Start next version cycle.

| Argument | Required | Description |
|----------|----------|-------------|
| `name` | No | Milestone name |
| `--reset-phase-numbers` | No | Restart the new milestone at Phase 1 and archive old phase dirs before roadmapping |

**Prerequisites:** Previous milestone completed
**Produces:** Updated `PROJECT.md`, new `REQUIREMENTS.md`, new `ROADMAP.md`

```bash
/wsf-new-milestone                  # Interactive
/wsf-new-milestone "v2.0 Mobile"    # Named milestone
/wsf-new-milestone --reset-phase-numbers "v2.0 Mobile"  # Restart milestone numbering at 1
```

---

## Phase Management Commands

### `/wsf-add-phase`

Append new phase to roadmap.

```bash
/wsf-add-phase                      # Interactive — describe the phase
```

### `/wsf-insert-phase`

Insert urgent work between phases using decimal numbering.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Insert after this phase number |

```bash
/wsf-insert-phase 3                 # Insert between phase 3 and 4 → creates 3.1
```

### `/wsf-remove-phase`

Remove future phase and renumber subsequent phases.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number to remove |

```bash
/wsf-remove-phase 7                 # Remove phase 7, renumber 8→7, 9→8, etc.
```

### `/wsf-list-phase-assumptions`

Preview Claude's intended approach before planning.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/wsf-list-phase-assumptions 2       # See assumptions for phase 2
```

### `/wsf-analyze-dependencies`

Analyze phase dependencies and suggest `Depends on` entries for ROADMAP.md before running `/wsf-manager`.

**Prerequisites:** `.planning/ROADMAP.md` exists
**Produces:** Dependency suggestion table; optionally updates `Depends on` fields in ROADMAP.md with confirmation

**Run this before `/wsf-manager`** when phases have empty `Depends on` fields and you want to avoid merge conflicts from unordered parallel execution.

```bash
/wsf-analyze-dependencies           # Analyze all phases and suggest dependencies
```

**Detection methods:**
- File overlap — phases touching the same files/domains must be ordered
- Semantic dependencies — a phase that consumes an API or schema built by another phase
- Data flow — a phase that reads output produced by another phase

---

### `/wsf-plan-milestone-gaps`

Create phases to close gaps from milestone audit.

```bash
/wsf-plan-milestone-gaps             # Creates phases for each audit gap
```

### `/wsf-research-phase`

Deep ecosystem research only (standalone — usually use `/wsf-plan-phase` instead).

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/wsf-research-phase 4               # Research phase 4 domain
```

### `/wsf-validate-phase`

Retroactively audit and fill Nyquist validation gaps.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/wsf-validate-phase 2               # Audit test coverage for phase 2
```

---

## Navigation Commands

### `/wsf-progress`

Show status and next steps.

```bash
/wsf-progress                       # "Where am I? What's next?"
```

### `/wsf-resume-work`

Restore full context from last session.

```bash
/wsf-resume-work                    # After context reset or new session
```

### `/wsf-pause-work`

Save context handoff when stopping mid-phase.

```bash
/wsf-pause-work                     # Creates continue-here.md
```

### `/wsf-manager`

Interactive command center for managing multiple phases from one terminal.

**Prerequisites:** `.planning/ROADMAP.md` exists
**Behavior:**
- Dashboard of all phases with visual status indicators
- Recommends optimal next actions based on dependencies and progress
- Dispatches work: discuss runs inline, plan/execute run as background agents
- Designed for power users parallelizing work across phases from one terminal
- Supports per-step passthrough flags via `manager.flags` config (see [Configuration](CONFIGURATION.md#manager-passthrough-flags))

```bash
/wsf-manager                        # Open command center dashboard
```

**Manager Passthrough Flags:**

Configure per-step flags in `.planning/config.json` under `manager.flags`. These flags are appended to each dispatched command:

```json
{
  "manager": {
    "flags": {
      "discuss": "--auto",
      "plan": "--skip-research",
      "execute": "--validate"
    }
  }
}
```

---

### `/wsf-help`

Show all commands and usage guide.

```bash
/wsf-help                           # Quick reference
```

---

## Utility Commands

### `/wsf-explore`

Socratic ideation session — guide an idea through probing questions, optionally spawn research, then route output to the right WSF artifact (notes, todos, seeds, research questions, requirements, or a new phase).

| Argument | Required | Description |
|----------|----------|-------------|
| `topic` | No | Topic to explore (e.g., `/wsf-explore authentication strategy`) |

```bash
/wsf-explore                        # Open-ended ideation session
/wsf-explore authentication strategy  # Explore a specific topic
```

---

### `/wsf-undo`

Safe git revert — roll back WSF phase or plan commits using the phase manifest with dependency checks and a confirmation gate.

| Flag | Required | Description |
|------|----------|-------------|
| `--last N` | (one of three required) | Show recent WSF commits for interactive selection |
| `--phase NN` | (one of three required) | Revert all commits for a phase |
| `--plan NN-MM` | (one of three required) | Revert all commits for a specific plan |

**Safety:** Checks dependent phases/plans before reverting; always shows a confirmation gate.

```bash
/wsf-undo --last 5                  # Pick from the 5 most recent WSF commits
/wsf-undo --phase 03                # Revert all commits for phase 3
/wsf-undo --plan 03-02              # Revert commits for plan 02 of phase 3
```

---

### `/wsf-import`

Ingest an external plan file into the WSF planning system with conflict detection against `PROJECT.md` decisions before writing anything.

| Flag | Required | Description |
|------|----------|-------------|
| `--from <filepath>` | **Yes** | Path to the external plan file to import |

**Process:** Detects conflicts → prompts for resolution → writes as WSF PLAN.md → validates via `wsf-plan-checker`

```bash
/wsf-import --from /tmp/team-plan.md  # Import and validate an external plan
```

---

### `/wsf-quick`

Execute ad-hoc task with WSF guarantees.

| Flag | Description |
|------|-------------|
| `--full` | Enable plan checking (2 iterations) + post-execution verification |
| `--discuss` | Lightweight pre-planning discussion |
| `--research` | Spawn focused researcher before planning |

Flags are composable.

```bash
/wsf-quick                          # Basic quick task
/wsf-quick --discuss --research     # Discussion + research + planning
/wsf-quick --full                   # With plan checking and verification
/wsf-quick --discuss --research --full  # All optional stages
```

### `/wsf-autonomous`

Run all remaining phases autonomously.

| Flag | Description |
|------|-------------|
| `--from N` | Start from a specific phase number |
| `--to N` | Stop after completing a specific phase number |
| `--interactive` | Lean context with user input |

```bash
/wsf-autonomous                     # Run all remaining phases
/wsf-autonomous --from 3            # Start from phase 3
/wsf-autonomous --to 5              # Run up to and including phase 5
/wsf-autonomous --from 3 --to 5     # Run phases 3 through 5
```

### `/wsf-do`

Route freeform text to the right WSF command.

```bash
/wsf-do                             # Then describe what you want
```

### `/wsf-note`

Zero-friction idea capture — append, list, or promote notes to todos.

| Argument | Required | Description |
|----------|----------|-------------|
| `text` | No | Note text to capture (default: append mode) |
| `list` | No | List all notes from project and global scopes |
| `promote N` | No | Convert note N into a structured todo |

| Flag | Description |
|------|-------------|
| `--global` | Use global scope for note operations |

```bash
/wsf-note "Consider caching strategy for API responses"
/wsf-note list
/wsf-note promote 3
```

### `/wsf-debug`

Systematic debugging with persistent state.

| Argument | Required | Description |
|----------|----------|-------------|
| `description` | No | Description of the bug |

| Flag | Description |
|------|-------------|
| `--diagnose` | Diagnosis-only mode — investigate without attempting fixes |

```bash
/wsf-debug "Login button not responding on mobile Safari"
/wsf-debug --diagnose "Intermittent 500 errors on /api/users"
```

### `/wsf-add-todo`

Capture idea or task for later.

| Argument | Required | Description |
|----------|----------|-------------|
| `description` | No | Todo description |

```bash
/wsf-add-todo "Consider adding dark mode support"
```

### `/wsf-check-todos`

List pending todos and select one to work on.

```bash
/wsf-check-todos
```

### `/wsf-add-tests`

Generate tests for a completed phase.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | No | Phase number |

```bash
/wsf-add-tests 2                    # Generate tests for phase 2
```

### `/wsf-stats`

Display project statistics.

```bash
/wsf-stats                          # Project metrics dashboard
```

### `/wsf-profile-user`

Generate a developer behavioral profile from Claude Code session analysis across 8 dimensions (communication style, decision patterns, debugging approach, UX preferences, vendor choices, frustration triggers, learning style, explanation depth). Produces artifacts that personalize Claude's responses.

| Flag | Description |
|------|-------------|
| `--questionnaire` | Use interactive questionnaire instead of session analysis |
| `--refresh` | Re-analyze sessions and regenerate profile |

**Generated artifacts:**
- `USER-PROFILE.md` — Full behavioral profile
- `/wsf-dev-preferences` command — Load preferences in any session
- `CLAUDE.md` profile section — Auto-discovered by Claude Code

```bash
/wsf-profile-user                   # Analyze sessions and build profile
/wsf-profile-user --questionnaire   # Interactive questionnaire fallback
/wsf-profile-user --refresh         # Re-generate from fresh analysis
```

### `/wsf-health`

Validate `.planning/` directory integrity.

| Flag | Description |
|------|-------------|
| `--repair` | Auto-fix recoverable issues |

```bash
/wsf-health                         # Check integrity
/wsf-health --repair                # Check and fix
```

### `/wsf-cleanup`

Archive accumulated phase directories from completed milestones.

```bash
/wsf-cleanup
```

---

## Diagnostics Commands

### `/wsf-forensics`

Post-mortem investigation of failed or stuck WSF workflows.

| Argument | Required | Description |
|----------|----------|-------------|
| `description` | No | Problem description (prompted if omitted) |

**Prerequisites:** `.planning/` directory exists
**Produces:** `.planning/forensics/report-{timestamp}.md`

**Investigation covers:**
- Git history analysis (recent commits, stuck patterns, time gaps)
- Artifact integrity (expected files for completed phases)
- STATE.md anomalies and session history
- Uncommitted work, conflicts, abandoned changes
- At least 4 anomaly types checked (stuck loop, missing artifacts, abandoned work, crash/interruption)
- GitHub issue creation offered if actionable findings exist

```bash
/wsf-forensics                              # Interactive — prompted for problem
/wsf-forensics "Phase 3 execution stalled"  # With problem description
```

---

## Workstream Management

### `/wsf-workstreams`

Manage parallel workstreams for concurrent work on different milestone areas.

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `list` | List all workstreams with status (default if no subcommand) |
| `create <name>` | Create a new workstream |
| `status <name>` | Detailed status for one workstream |
| `switch <name>` | Set active workstream |
| `progress` | Progress summary across all workstreams |
| `complete <name>` | Archive a completed workstream |
| `resume <name>` | Resume work in a workstream |

**Prerequisites:** Active WSF project
**Produces:** Workstream directories under `.planning/`, state tracking per workstream

```bash
/wsf-workstreams                    # List all workstreams
/wsf-workstreams create backend-api # Create new workstream
/wsf-workstreams switch backend-api # Set active workstream
/wsf-workstreams status backend-api # Detailed status
/wsf-workstreams progress           # Cross-workstream progress overview
/wsf-workstreams complete backend-api  # Archive completed workstream
/wsf-workstreams resume backend-api    # Resume work in workstream
```

---

## Configuration Commands

### `/wsf-settings`

Interactive configuration of workflow toggles and model profile.

```bash
/wsf-settings                       # Interactive config
```

### `/wsf-set-profile`

Quick profile switch.

| Argument | Required | Description |
|----------|----------|-------------|
| `profile` | **Yes** | `quality`, `balanced`, `budget`, or `inherit` |

```bash
/wsf-set-profile budget             # Switch to budget profile
/wsf-set-profile quality            # Switch to quality profile
```

---

## Brownfield Commands

### `/wsf-map-codebase`

Analyze existing codebase with parallel mapper agents.

| Argument | Required | Description |
|----------|----------|-------------|
| `area` | No | Scope mapping to a specific area |

```bash
/wsf-map-codebase                   # Full codebase analysis
/wsf-map-codebase auth              # Focus on auth area
```

---

### `/wsf-scan`

Rapid single-focus codebase assessment — lightweight alternative to `/wsf-map-codebase` that spawns one mapper agent instead of four parallel ones.

| Flag | Description |
|------|-------------|
| `--focus tech\|arch\|quality\|concerns\|tech+arch` | Focus area (default: `tech+arch`) |

**Produces:** Targeted document(s) in `.planning/codebase/`

```bash
/wsf-scan                           # Quick tech + arch overview
/wsf-scan --focus quality           # Quality and code health only
/wsf-scan --focus concerns          # Surface concerns and risk areas
```

---

### `/wsf-intel`

Query, inspect, or refresh queryable codebase intelligence files stored in `.planning/intel/`. Requires `intel.enabled: true` in `config.json`.

| Argument | Description |
|----------|-------------|
| `query <term>` | Search intel files for a term |
| `status` | Show intel file freshness (FRESH/STALE) |
| `diff` | Show changes since last snapshot |
| `refresh` | Rebuild all intel files from codebase analysis |

**Produces:** `.planning/intel/` JSON files (stack, api-map, dependency-graph, file-roles, arch-decisions)

```bash
/wsf-intel status                   # Check freshness of intel files
/wsf-intel query authentication     # Search intel for a term
/wsf-intel diff                     # What changed since last snapshot
/wsf-intel refresh                  # Rebuild intel index
```

---

## Patch Commands

### `/wsf-reapply-patches`

Restore local modifications after a WSF update.

```bash
/wsf-reapply-patches                # Merge back local changes
```

---

## Code Quality Commands

### `/wsf-code-review`

Review source files changed during a phase for bugs, security vulnerabilities, and code quality problems.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | **Yes** | Phase number whose changes to review (e.g., `2` or `02`) |
| `--depth=quick\|standard\|deep` | No | Review depth level (overrides `workflow.code_review_depth` config). `quick`: pattern-matching only (~2 min). `standard`: per-file analysis with language-specific checks (~5–15 min, default). `deep`: cross-file analysis including import graphs and call chains (~15–30 min) |
| `--files file1,file2,...` | No | Explicit comma-separated file list; skips SUMMARY/git scoping entirely |

**Prerequisites:** Phase has been executed and has SUMMARY.md or git history
**Produces:** `{phase}-REVIEW.md` in phase directory with severity-classified findings
**Spawns:** `wsf-code-reviewer` agent

```bash
/wsf-code-review 3                          # Standard review for phase 3
/wsf-code-review 2 --depth=deep             # Deep cross-file review
/wsf-code-review 4 --files src/auth.ts,src/token.ts  # Explicit file list
```

---

### `/wsf-code-review-fix`

Auto-fix issues found by `/wsf-code-review`. Reads `REVIEW.md`, spawns a fixer agent, commits each fix atomically, and produces a `REVIEW-FIX.md` summary.

| Argument | Required | Description |
|----------|----------|-------------|
| `N` | **Yes** | Phase number whose REVIEW.md to fix |
| `--all` | No | Include Info findings in fix scope (default: Critical + Warning only) |
| `--auto` | No | Enable fix + re-review iteration loop, capped at 3 iterations |

**Prerequisites:** Phase has a `{phase}-REVIEW.md` file (run `/wsf-code-review` first)
**Produces:** `{phase}-REVIEW-FIX.md` with applied fixes summary
**Spawns:** `wsf-code-fixer` agent

```bash
/wsf-code-review-fix 3                      # Fix Critical + Warning findings for phase 3
/wsf-code-review-fix 3 --all               # Include Info findings
/wsf-code-review-fix 3 --auto              # Fix and re-review until clean (max 3 iterations)
```

---

### `/wsf-audit-fix`

Autonomous audit-to-fix pipeline — runs an audit, classifies findings, fixes auto-fixable issues with test verification, and commits each fix atomically.

| Flag | Description |
|------|-------------|
| `--source <audit>` | Which audit to run (default: `audit-uat`) |
| `--severity high\|medium\|all` | Minimum severity to process (default: `medium`) |
| `--max N` | Maximum findings to fix (default: 5) |
| `--dry-run` | Classify findings without fixing (shows classification table) |

**Prerequisites:** At least one phase has been executed with UAT or verification
**Produces:** Fix commits with test verification; classification report

```bash
/wsf-audit-fix                              # Run audit-uat, fix medium+ issues (max 5)
/wsf-audit-fix --severity high             # Only fix high-severity issues
/wsf-audit-fix --dry-run                   # Preview classification without fixing
/wsf-audit-fix --max 10 --severity all     # Fix up to 10 issues of any severity
```

---

## Fast & Inline Commands

### `/wsf-fast`

Execute a trivial task inline — no subagents, no planning overhead. For typo fixes, config changes, small refactors, forgotten commits.

| Argument | Required | Description |
|----------|----------|-------------|
| `task description` | No | What to do (prompted if omitted) |

**Not a replacement for `/wsf-quick`** — use `/wsf-quick` for anything needing research, multi-step planning, or verification.

```bash
/wsf-fast "fix typo in README"
/wsf-fast "add .env to gitignore"
```

---

### `/wsf-review`

Cross-AI peer review of phase plans from external AI CLIs.

| Argument | Required | Description |
|----------|----------|-------------|
| `--phase N` | **Yes** | Phase number to review |

| Flag | Description |
|------|-------------|
| `--gemini` | Include Gemini CLI review |
| `--claude` | Include Claude CLI review (separate session) |
| `--codex` | Include Codex CLI review |
| `--coderabbit` | Include CodeRabbit review |
| `--opencode` | Include OpenCode review (via GitHub Copilot) |
| `--all` | Include all available CLIs |

**Produces:** `{phase}-REVIEWS.md` — consumable by `/wsf-plan-phase --reviews`

```bash
/wsf-review --phase 3 --all
/wsf-review --phase 2 --gemini
```

---

### `/wsf-pr-branch`

Create a clean PR branch by filtering out `.planning/` commits.

| Argument | Required | Description |
|----------|----------|-------------|
| `target branch` | No | Base branch (default: `main`) |

**Purpose:** Reviewers see only code changes, not WSF planning artifacts.

```bash
/wsf-pr-branch                     # Filter against main
/wsf-pr-branch develop             # Filter against develop
```

---

### `/wsf-audit-uat`

Cross-phase audit of all outstanding UAT and verification items.

**Prerequisites:** At least one phase has been executed with UAT or verification
**Produces:** Categorized audit report with human test plan

```bash
/wsf-audit-uat
```

---

### `/wsf-secure-phase`

Retroactively verify threat mitigations for a completed phase.

| Argument | Required | Description |
|----------|----------|-------------|
| `phase number` | No | Phase to audit (default: last completed phase) |

**Prerequisites:** Phase must have been executed. Works with or without existing SECURITY.md.
**Produces:** `{phase}-SECURITY.md` with threat verification results
**Spawns:** `wsf-security-auditor` agent

Three operating modes:
1. SECURITY.md exists — audit and verify existing mitigations
2. No SECURITY.md but PLAN.md has threat model — generate from artifacts
3. Phase not executed — exits with guidance

```bash
/wsf-secure-phase                   # Audit last completed phase
/wsf-secure-phase 5                 # Audit specific phase
```

---

### `/wsf-docs-update`

Generate or update project documentation verified against the codebase.

| Argument | Required | Description |
|----------|----------|-------------|
| `--force` | No | Skip preservation prompts, regenerate all docs |
| `--verify-only` | No | Check existing docs for accuracy, no generation |

**Produces:** Up to 9 documentation files (README, architecture, API, getting started, development, testing, configuration, deployment, contributing)
**Spawns:** `wsf-doc-writer` agents (one per doc type), then `wsf-doc-verifier` agents for factual verification

Each doc writer explores the codebase directly — no hallucinated paths or stale signatures. Doc verifier checks claims against the live filesystem.

```bash
/wsf-docs-update                    # Generate/update docs interactively
/wsf-docs-update --force            # Regenerate all docs
/wsf-docs-update --verify-only      # Verify existing docs only
```

---

## Backlog & Thread Commands

### `/wsf-add-backlog`

Add an idea to the backlog parking lot using 999.x numbering.

| Argument | Required | Description |
|----------|----------|-------------|
| `description` | **Yes** | Backlog item description |

**999.x numbering** keeps backlog items outside the active phase sequence. Phase directories are created immediately so `/wsf-discuss-phase` and `/wsf-plan-phase` work on them.

```bash
/wsf-add-backlog "GraphQL API layer"
/wsf-add-backlog "Mobile responsive redesign"
```

---

### `/wsf-review-backlog`

Review and promote backlog items to active milestone.

**Actions per item:** Promote (move to active sequence), Keep (leave in backlog), Remove (delete).

```bash
/wsf-review-backlog
```

---

### `/wsf-plant-seed`

Capture a forward-looking idea with trigger conditions — surfaces automatically at the right milestone.

| Argument | Required | Description |
|----------|----------|-------------|
| `idea summary` | No | Seed description (prompted if omitted) |

Seeds solve context rot: instead of a one-liner in Deferred that nobody reads, a seed preserves the full WHY, WHEN to surface, and breadcrumbs to details.

**Produces:** `.planning/seeds/SEED-NNN-slug.md`
**Consumed by:** `/wsf-new-milestone` (scans seeds and presents matches)

```bash
/wsf-plant-seed "Add real-time collaboration when WebSocket infra is in place"
```

---

### `/wsf-thread`

Manage persistent context threads for cross-session work.

| Argument | Required | Description |
|----------|----------|-------------|
| (none) | — | List all threads |
| `name` | — | Resume existing thread by name |
| `description` | — | Create new thread |

Threads are lightweight cross-session knowledge stores for work that spans multiple sessions but doesn't belong to any specific phase. Lighter weight than `/wsf-pause-work`.

```bash
/wsf-thread                         # List all threads
/wsf-thread fix-deploy-key-auth     # Resume thread
/wsf-thread "Investigate TCP timeout in pasta service"  # Create new
```

---

## State Management Commands

### `state validate`

Detect drift between STATE.md and the actual filesystem.

**Prerequisites:** `.planning/STATE.md` exists
**Produces:** Validation report showing any drift between STATE.md fields and filesystem reality

```bash
node wsf-tools.cjs state validate
```

---

### `state sync [--verify]`

Reconstruct STATE.md from actual project state on disk.

| Flag | Description |
|------|-------------|
| `--verify` | Dry-run mode — show proposed changes without writing |

**Prerequisites:** `.planning/` directory exists
**Produces:** Updated `STATE.md` reflecting filesystem reality

```bash
node wsf-tools.cjs state sync             # Reconstruct STATE.md from disk
node wsf-tools.cjs state sync --verify    # Dry-run: show changes without writing
```

---

### `state planned-phase`

Record state transition after plan-phase completes (Planned/Ready to execute).

| Flag | Description |
|------|-------------|
| `--phase N` | Phase number that was planned |
| `--plans N` | Number of plans generated |

**Prerequisites:** Phase has been planned
**Produces:** Updated `STATE.md` with post-planning state

```bash
node wsf-tools.cjs state planned-phase --phase 3 --plans 2
```

---

## Community Commands

### Community Hooks

Optional git and session hooks gated behind `hooks.community: true` in `.planning/config.json`. All are no-ops unless explicitly enabled.

| Hook | Purpose |
|------|---------|
| `wsf-validate-commit.sh` | Enforce Conventional Commits format on git commit messages |
| `wsf-session-state.sh` | Track session state transitions |
| `wsf-phase-boundary.sh` | Enforce phase boundary checks |

Enable with:
```json
{ "hooks": { "community": true } }
```

---

### `/wsf-join-discord`

Open Discord community invite.

```bash
/wsf-join-discord
```
