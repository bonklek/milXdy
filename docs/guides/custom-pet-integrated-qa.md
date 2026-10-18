# Custom Pet integrated QA

The local integration workflow checks a user-selected v2 atlas, an explicitly
reviewed request bundle, template selection, import validation, deterministic
QA, semantic review, and exact cache reuse.

Use a read-only source directory and a private expected-results record:

```powershell
$env:PYTHON = "<python-with-Pillow>"
npm.cmd run verify:remilia-pet-integration -- `
  --source-root="<read-only-source-root>" `
  --expected="<private-expected-results.json>"
```

The verifier uses temporary local output, leaves source inputs unchanged,
and checks exact hashes. Keep private expected-results and semantic review
records outside public source control. Deterministic validation does not
replace visual review or establish permission to publish a character.

This workflow does not authorize publication, installation, uploading, or
posting. Public release archives contain the adapter and template contracts;
they contain no private sample sprites or review records.
