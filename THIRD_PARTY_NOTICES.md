# Third-Party Notices

milXdy's original code is licensed under the Viral Public License in `LICENSE`.
The components below retain their own licenses. Those licenses apply to the
components themselves and are not replaced by milXdy's VPL.

| Component | Version | Use in distributed builds | License |
| --- | --- | --- | --- |
| `@chenglou/pretext` | 0.0.8 | Unicode-aware multiline Canvas layout in the user-invoked Share Kit package | MIT (`third_party/licenses/pretext-MIT.txt`) |
| `@unimusic/chromaprint` | 0.1.4 | Local audio fingerprint wrapper and packaged Chromaprint WebAssembly | Wrapper MIT (`third_party/licenses/unimusic-chromaprint-MIT.txt`); underlying engine notices described below |
| `qrcode` | 1.5.4 | QR-code generation | MIT (`third_party/licenses/qrcode-MIT.txt`) |
| `dijkstrajs` | 1.0.3 | QR-code generation dependency | MIT (`third_party/licenses/dijkstrajs-MIT.txt`) |
| `jsqr` | 1.4.0 | QR-code recognition | Apache-2.0 (`third_party/licenses/Apache-2.0.txt`) |
| `solid-js` | 1.9.13 | Milady Maxxer interface | MIT (`third_party/licenses/solid-js-MIT.txt`) |
| `regenerator-runtime` | 0.13.11 | OCR worker runtime dependency | MIT (`third_party/licenses/regenerator-runtime-MIT.txt`) |
| `onnxruntime-web` | 1.27.0 | Browser model inference | MIT (`third_party/onnxruntime-web/LICENSE.txt`); bundled upstream notices are in `third_party/onnxruntime-web/ThirdPartyNotices.txt` |
| `tesseract.js` | 7.0.0 | OCR | Apache-2.0 (`third_party/licenses/Apache-2.0.txt`) |
| `tesseract.js-core` | 7.0.0 | OCR engine | Apache-2.0 (`third_party/licenses/Apache-2.0.txt`) |
| `@tesseract.js-data/eng` | 1.0.0 | English OCR language data | Conservatively documented under the upstream tessdata Apache-2.0 license (`third_party/licenses/Apache-2.0.txt`) |
The dependency names and versions above describe the full standard build.
Reduced/custom build profiles may omit some of them; retaining an unused
notice in such a build does not add that component to the build.

## Chromaprint engine provenance

The wrapper's MIT license does not replace the licenses of its compiled engine.
The upstream wrapper [build recipe](https://github.com/UniMusic-app/unimusic-chromaprint/blob/main/build-wasm.sh)
uses Chromaprint and KISS FFT. Their upstream declarations are retained in
`third_party/licenses/chromaprint-upstream.txt`, `kissfft-COPYING.txt`, and
`kissfft-BSD-3-Clause.txt`. Chromaprint's declaration describes MIT source plus
included LGPL 2.1 FFmpeg code; KISS FFT declares BSD-3-Clause.

The npm registry metadata for 0.1.4 identifies wrapper source commit
[`ea8a9547f858996d4ffaaf148b7df2ce7f471abd`](https://github.com/UniMusic-app/unimusic-chromaprint/tree/ea8a9547f858996d4ffaaf148b7df2ce7f471abd).
Its Git submodule entries identify Chromaprint revision
`ac31acc8431defbb134ec54eb11daf9146c74170` and KISS FFT revision
`febd4caeed32e33ad8b2e0bb5ea77542c40f18ec`, matching the retained declarations.
The installed WASM and JavaScript match the npm archive verified against its
registry SHA-512 integrity. Their SHA-256 values are:

- `chromaprint.wasm`: `7d31fa9acfc575b726f809e6441aff1d618c022b0d24f980db77075b0011b9ad`
- `chromaprint.js`: `6f2c33e45428a4f8824e3a3ae63ca3c75bfed7ca570f535005283a9cbbaff42c`

This establishes the distributed package identity and its declared source
reference, but does not prove how the precompiled engine was built. The pinned
[build recipe](https://github.com/UniMusic-app/unimusic-chromaprint/blob/ea8a9547f858996d4ffaaf148b7df2ce7f471abd/build-wasm.sh)
selects KISS FFT but does not pin Emscripten or record the final binary build.
Chromaprint's pinned source also enables its internal FFmpeg avresample code by
default; selecting KISS FFT does not establish that this LGPL-covered code is
absent. Before release, establish the binary's actual source/build configuration
and satisfy the applicable engine distribution requirements. These notices
alone do not establish that review is complete.
