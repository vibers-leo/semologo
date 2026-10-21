# Durable logo composition collection plan

The canonical list is `semologo.logo_composition_plan` in the existing SemoLogo CMS database. It is an internal collection plan, not a new public catalog. Existing brand IDs remain the update destination.

Four tracked forms:
- `symbol`: symbol/icon
- `wordmark`: logotype/text logo; these are aliases for one collection slot
- `horizontal`: horizontal combination
- `vertical`: vertical combination

Each form is `available_verified`, `review_required`, `collect_needed`, `unassessed`, or `not_offered`. Only explicitly reviewed variant metadata and non-rejected files count as verified. Unknown legacy composition metadata is unassessed, rather than proof that a form is absent. Reusing the same artwork across all four labels cannot complete coverage. A `not_offered` decision requires a dated official-source reference and review note in `logo_composition_decisions`; a later verified asset supersedes that decision.

Priorities: user requests, named focus brands, brands with at least ten recent opens/downloads, Korean public institutions, fashion. Rank inputs use current CMS traffic, not an invented GA4 ranking. A refresh audits at most 200 records, combining named/popular focus identities, new Korean public-institution identities, catalog backfill and stale/changed identities and retains prior attempts and manual evidence. Merged/hidden identities are excluded. Missing/ambiguous official domains remain visible in the list for source enrichment.

## Collection connection

NCP runs the planner every thirty minutes. At most two new jobs per run use the existing `semologo-domain-discover` kind on win-01/win-02, with a four-job per-worker SemoLogo queue cap. An existing in-flight discovery for the same domain is reused. The same brand/cycle has an idempotent request key. The collector commit is taken only from successful jobs for that worker.

The existing collector discovers official-site logo signals. `requestedForms` is collection-plan context; it does not make the installed collector infer artwork composition or recursively parse every CI guide. Official CI pages are retained in the plan and the existing Korean CI original-file archive continues separately. Source discovery success, downloaded candidates, composition review and published coverage are distinct. No new crawler capability, worker installation, brand rights or automatic four-form completion is implied.

Completed attempts wait 7, 14, then 30 days before another discovery. Newly published reviewed variants are reflected at the next audit. Official source changes and manual review can reset a due date deliberately. Existing CMS publication guards stay in force; this scheduler itself never replaces representatives or publishes artwork.

## Operations

Source: `scripts/composition-plan/`. Runtime: `/root/projects/semologo-composition-plan/` on the existing `vibers` SSH host. `COMMIT` pins the dedicated `ops/composition-plan-20261021` source branch. The web image and the existing bulk/request collection schedules are unchanged.

- `python3 run.py --init`: additive schema installation.
- `python3 run.py --dry-run`: persist a bounded audit, simulate fleet inserts under rollback, and save its report. The dry-run output's generated job IDs are not real queued jobs.
- `python3 run.py --test`: one real bounded cycle and persistence test.
- `python3 run.py --status`: read current counts and top 100 plans.
- Ordinary invocation: refresh, queue/reconcile, save private receipt.

`state/latest.json` is updated only after a successful cycle; `state/runs/` retains individual receipts. If the process crashes between queue insert and CMS sync, the next run recovers by its stable request key or existing in-flight domain job. Credentials are inherited only inside the existing containers; no browser or Windows credential distribution is added. PgBouncer-compatible client query timeouts are used.

Disable with `systemctl disable --now semologo-composition-plan.timer`. This stops new planner scheduling without stopping workers or other collection timers. Existing jobs complete normally; durable CMS plans, original files and review decisions remain. No database table or source object needs deletion.

Validation: `node --test scripts/composition-plan/policy.test.cjs`; real CMS persistence, fleet dispatch/status, private result-manifest hashes and timer receipts are recorded under `/Volumes/HDD-1TB/semologo-migration/composition-plan-20261021/`.

Reusable module candidate: durable per-identity composition coverage, evidence-backed not-offered decisions, and idempotent existing-worker retry adapter. Reference implementation remains in this project; no client data is copied into a shared module.
