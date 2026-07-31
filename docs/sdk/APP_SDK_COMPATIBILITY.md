# App SDK Compatibility Policy

The compatibility, versioning, migration, support, and security policy now has
one canonical home: the
[App Platform Support Contract](APP_PLATFORM_PRODUCTION_READINESS.md#versioning-and-support).

This file remains as a stable link for existing documentation and integrations.

Current App SDK 0.2.4 boundaries:

- Catalog selections and trusted manual ZIPs are composed into managed Chromium
  builds.
- Direct folder and ZIP composer commands remain supported author tooling.
- Novel packages use generated Apps & Features metadata for enablement.
- Stable builds expose a composition fingerprint and Chrome reload identity.
- Package-owned background module | Use host-provided declared services.
- Runtime installation, remote marketplace updates, arbitrary-site execution,
  and capability-isolated third-party execution are outside this contract.

For package fields and APIs, use the [App SDK reference](APP_SDK.md). For the
installation procedure, use [Local Add-ons](LOCAL_ADDONS.md).
