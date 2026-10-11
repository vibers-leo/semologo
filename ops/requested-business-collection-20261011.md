# Requested finance and business logos — 2026-10-11

13 identities examined. Nine new CMS identities and one rehabilitated legacy identity, sixteen reviewed SVG/transparent PNG variants, 39 immutable CDN objects uploaded and byte verified. Official originals retained locally; Jeonbuk Bank AI/ZIP and attributed SK Securities EPS ZIP are downloadable variants.

Published: GS리테일 (Korean/English, original vector gradients preserved), 전북은행 (horizontal/vertical/symbol), 신한투자증권 (Korean signature), SK증권 (Korean/English), 유니포스트, 로움아이티, NICE디앤알, 퍼핀 (Korean logo/character lockup).

SK Securities EPS comes from the explicitly attributed ILUO public source; visually compared with the official SK Securities report/homepage. It is not labeled an official download. The other nine use official site vectors or original report path data. Roumit is a white official variant and has light-logo flags for dark presentation. Original intentional whites in Jeonbuk Bank were preserved.

우아한형제들 official Korean/English homepage SVGs were recovered from exact official Vue path attributes. The legacy `woowa` ID, version ID and metadata were preserved; hidden flags were cleared only after vector/PNG visual review. Official white letters and black shadows are preserved. 비젠트로 official AI provides English/Korean signatures with AX Transformation tagline; Poppler retained the official blue while MuPDF ICC conversion produced an incorrect green (rejected). Original AI and ZIP are downloadable. GS25 remains separate from GS Retail. NICE D&R remains separate from NICE D&B. BIZENTRO's correct Korean name is 비젠트로.

Remaining three: 당근페이, 쿠팡페이, 지머니트랜스. Official PNG originals are preserved; true vector originals remain unavailable. 지머니트랜스 PNGs were downloaded via the official browser page after curl WAF failure. Project CLAUDE.md forbids publishing new PNG-only identities. No raster wrapper or automatic tracing was used.

Evidence: `extracted.json`, `uploads.json`, `published.json`, `identity-preflight.json`, contact sheet and untouched source packages in the release directory. Screenshot review passed for all sixteen published variants. Public-front validation is recorded separately after deployment.

Operational value: ten usable search results now; original archives and the three precise source/quality blockers remain the supporting 10% for future collection follow-up.

GS Retail extraction correction: PyMuPDF renders PDF shading as image strips during SVG export; raw PDF inspection found 21 `sh` operations, seven shading resources and zero inline BI images. Poppler import preserved 21 vector gradients; only two actual raster grid images were removed. Both signatures passed visual review with zero image elements.

Production validation: commit f470d18 deployed; all 10 Korean-name catalog queries include the canonical ID, all 10 detail pages return HTTP 200 with the expected immutable representative PNG path. Evidence: ops/evidence/requested-business-front-20261011.json (all_pass=true).
