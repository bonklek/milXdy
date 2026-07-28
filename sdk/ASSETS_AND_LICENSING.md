# Package Assets And Licensing

App authors are responsible for every shipped icon, image, font, audio file,
model, WASM binary, worker, stylesheet, and bundled dependency.

Before review:

1. Declare entry code and styles through `contentEntry` and `css`, every
   supplemental shipped file in `package.assets`, and every page-loadable file
   in `package.webAccessibleAssets`; use `context.resolveAssetUrl()` for URLs.
2. Record the source, author, license identifier or terms, modification status,
   and required attribution for each third-party asset in the package README or
   an asset inventory.
3. Include required license and notice text in the package. Do not assume the
   milXdy repository license grants rights to independently sourced material.
4. Optimize files, strip unnecessary metadata, and avoid embedding secrets,
   personal information, remote executable code, or unreviewed tracking URLs.
5. Use original, public-domain, or clearly licensed replacements when rights are
   uncertain. Reviewers should block a package whose redistribution rights
   cannot be established.

Independently authored packages retain their own licensing obligations. Package
acceptance, composition, or static scanning is not legal approval and does not
transfer copyright or trademark rights.

This general package policy is license-neutral. Declaring an asset, supplying a
hash, or calling material VPL does not admit it to any official VPL catalog;
that future catalog requires separate file-level provenance evidence and human
review. Treat visual URLs and screenshots as reference material, not package
assets, unless the exact file is an intentionally declared shipping export.
Packages vendor those declared files into the reviewed build and must not
hot-load arbitrary remote assets at runtime.
