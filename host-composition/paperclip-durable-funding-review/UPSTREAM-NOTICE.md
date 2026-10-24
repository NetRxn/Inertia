# Upstream provenance and license

This bundle contains a narrow patch, qualification tests and integration contracts, not a vendored Paperclip distribution. Bootstrap obtains the pinned official npm dependency through package-lock.json integrity-checked registry.npmjs.org tarballs.

Qualified source baseline (not a permanent latest-version policy):
- paperclipai and @paperclipai/{server,db,shared,plugin-sdk}: 2026.1012.0.
- Official package: https://www.npmjs.com/package/@paperclipai/server/v/2026.1012.0
- Repository declared by that package: https://github.com/paperclipai/paperclip
- Installed server build commit: bba6a45f0d364cfd962ac59b3bdf2426a8222adb.
- Original and patched source SHA256: patches/pinned-files.json.
- Official package license metadata: MIT. LICENSE.paperclip is copied unchanged from the official installed paperclipai 2026.1012.0 npm distribution.
- The official repository MIT notice was independently read at https://raw.githubusercontent.com/paperclipai/paperclip/master/LICENSE on 2026-10-24 and matches the shipped copyright notice (2025 Paperclip AI). This establishes licensing, not equivalence of latest source to this baseline.

The included narrow patch changes an installed upstream package locally; it is not represented as an upstream-supported API. Preserve the MIT notice with any substantial upstream-derived code. Third-party dependency notices remain inside fetched packages. The bundle does not include private PPC2 code, credentials, node_modules, database data, or vendored upstream source.

The Linux x64 qualification fixture uses official @embedded-postgres/linux-x64 18.1.0-beta.16 (https://github.com/leinelissen/embedded-postgres), installed under the lock. Its binary/script fingerprints are verified before execution. Explicit NATIVE_PG_BIN can point to an already-installed copy only if its exact binaries match. Other platforms need explicit requalification.
