# Submit a milXdy Add-on for Catalog Consideration

The milXdy add-on catalog is currently maintainer-curated. To propose an app, feature, or theme package, open a GitHub **Add-on catalog submission** issue in this repository and provide the information requested by the issue form. The maintainer reviews the submission in GitHub and records the outcome there.

Submitting an add-on is a request for review, not automatic publication. A maintainer may request changes, accept a package for the catalog, or decline or defer it. Only an accepted package may be represented as catalog-reviewed.

This process covers catalog consideration only. It does not create a public package registry, a signing or trust guarantee, an automated publishing pipeline, or a remote package installation/update system. Those remain separate future work.

## Before submitting

Build the add-on against the current package contract and review the SDK guidance first:

- [App SDK](../sdk/APP_SDK.md), including the local package shape and its security limits
- [Local package manifest schema](../schemas/local-app-package.schema.json)
- [Local package examples](../../examples/packages/local-dev/README.md)

The current package path is a reviewed custom-build input, not a sandboxed runtime plugin or general public installer. Do not describe a submission as safe, signed, or automatically installable merely because it has been submitted for review.

## Required submission contents

Use the issue form whenever available. Include all of the following:

- **Identity and compatibility:** package name, stable package ID, version, package kind (`app`, `feature`, or `theme`), and the milXdy/App SDK compatibility target.
- **User-facing presentation:** a concise description of what users get, plus screenshots or a short recording that shows the visible surfaces. Link to public attachments or include them in the issue.
- **Reviewable deliverable:** a source repository, or a reviewable package artifact (such as a ZIP) with enough source or build information to assess it. State the exact version, tag, commit, or artifact checksum being reviewed.
- **Capabilities and network use:** declared host/optional permissions, lifecycle or injected surfaces, storage behavior, background/message use, and every network endpoint, WebSocket, remote service, or data transfer. Say `none` explicitly when applicable.
- **Test and QA evidence:** commands run, their results, supported browser and milXdy versions, and concise manual test steps/results for normal use and failure or disablement behavior.
- **Assets:** the license and attribution/source for every non-original icon, image, font, audio file, code sample, or other shipped asset. State that all assets are original if that is the case.
- **Maintainer contact and updates:** the GitHub account or repository issue location where maintainers can reach the author, plus who will respond to review feedback, compatibility changes, security reports, and future updates.

Never post secrets, API keys, tokens, cookies, private credentials, private user data, or unredacted production logs in a submission. Provide a redacted reproduction or a maintainer-safe contact route instead.

## Maintainer review checklist

Maintainers should record review notes and the final decision on the submission issue. Review at least the following:

- [ ] The manifest/package is valid, complete, and matches the submitted artifact and claimed identity/version.
- [ ] The declared SDK and milXdy compatibility target is supported and the package uses supported runtime surfaces rather than undocumented private interfaces.
- [ ] Capabilities, permissions, injected surfaces, storage, messages, and all network endpoints/services are declared, necessary, and appropriately narrow.
- [ ] No unsafe, private, secret-bearing, or licensing-problem assets or dependencies are included; asset attribution is sufficient.
- [ ] The UI is understandable, consistent with milXdy style expectations, and has a basic accessibility sanity check (labels, keyboard/focus behavior, contrast, and readable states where applicable).
- [ ] Installation/custom-build composition, update, disablement/removal, and rollback behavior have been exercised or have clear, truthful limitations.
- [ ] Submitted QA evidence is reproducible enough for the claimed supported browser and compatibility target.

## Review outcomes

Use one clear outcome on the GitHub issue:

- **Request changes:** the package may be reconsidered after specific missing information or technical/quality issues are addressed.
- **Accept for catalog:** the reviewed version may be added to the maintainer-curated catalog with its source, compatibility, permissions/data, and review metadata.
- **Decline/defer:** the submission is not being cataloged now. Record the reason when it is safe and useful, such as unsupported SDK scope, incomplete reviewability, a security/privacy concern, or a deferred platform dependency.

Catalog acceptance is a review decision for the identified version and does not promise continuing compatibility, future updates, broad safety guarantees, or automatic publication. Material updates should open or update a GitHub submission with a new version, changed capability/network disclosure, and fresh QA evidence.

## Catalog status and future scope

The catalog is a maintainer-reviewed discovery layer. It does not prevent future advanced local/custom-build use of unlisted packages, and it does not make an unreviewed package maintainer-endorsed. Public registry hosting, package signatures, trust guarantees, remote discovery, automated publishing, and normal-user install/update flows are intentionally out of scope for this documentation and require separate design and implementation work.
