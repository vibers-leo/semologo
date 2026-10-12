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
