# Versioned assets

This directory may contain local examples or reviewed upstream/default assets.
The publication candidate currently uses synthetic files under `fixtures/`
instead of bundling a default artwork library.

Content-addressed storage is recommended for shared local work and required for
upstream/default releases:

```text
assets/<source-sha256>/
  source/<original-file>
  exports/<declared-export>
```

Local packages do not need to copy their full source library here. They may
vendor only the exports declared by their package manifest.
