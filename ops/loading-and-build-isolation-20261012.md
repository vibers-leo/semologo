# Loading and build isolation — 2026-10-12

Production SemoLogo deployment 85d1072 succeeded. Investigation after the user reported continued slow loading:

- Public slim catalog: 182,313 records, no absolute external URLs in logo_png/logo_svg/preview_png/icon_png.
- Bundled reviewed image fields: 1,579 absolute addresses, all logo.vibers.co.kr. Source attribution URLs are separate from display image URLs.
- Mac sample: home IPv4 0.338s vs IPv6 6.082s; image IPv4 0.477s vs IPv6 1.075s. This is a routing clue, not proof for all clients.
- Browser initial script files total 4,267,793 uncompressed bytes; largest chunk 2,871,385 bytes contains full reviewed manifests.
- Shared production build hit its 4GiB cap and sustained memory PSI. Memory limits do not isolate operating services from CPU/I/O/reclaim contention. Faneasy build client was cancelled; operating container unchanged. Retry is not automatically relaunched.

Fix: client-safe grid sorting, lazy logo detail modal, per-brand variant API instead of bundled archive, quality vote records imported independently of all asset manifests. Server-side review/representative rules retained.

Prepared prebuilt delivery: local Linux amd64 image + revision label, SHA-256 verified transfer, image platform/revision validation, app/global locks, old image rollback tag, compose health and image identity check. `.prebuilt-only` marker opts a project out of production-host compilation. Other projects are not automatically migrated.

Local VM disks use existing ~/.colima/_lima -> HDD relocation. Short profile b avoids UNIX socket path length limit. No default Docker context changes. Full local build/deployment and before/after byte verification are pending until completed; do not report these as successful yet.

## Network mitigation applied — 2026-10-13

SemoLogo zone reported IPv6 editable=true. Previous setting snapshot kept privately in task-tmp/semologo-ipv6-before-20261013.json. Changed only semologo.com zone ipv6 on→off; logo.vibers.co.kr/vibers.co.kr settings untouched. Public resolver AAAA response empty after change. Cloudflare proxy and TLS remain enabled.

Actual Chrome navigation before mitigation TTFB16,772.8ms / load18,171.9ms; after reload TTFB468.7ms / load1,296.4ms. These are one-machine before/after samples, not a global latency guarantee; cache and background tab effects mean paint timestamps are not a reliable comparison. Viewport logo files loaded.

Production builder stopped after no active build clients and global-lock acquisition. PSI some/full avg10 reached0.00. Production compilation disabled for SemoLogo via .prebuilt-only marker. Other project build pipelines still need individual migration.

Native browser lazy images and removing hydration-gated opacity address logos remaining invisible while client code starts. Local amd64 Alpine Node installation hit a libuv assertion, so image base changed to Node22 bookworm-slim for cross-platform build compatibility; validation pending final build result.
