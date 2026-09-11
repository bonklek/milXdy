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

The retained declarations were retrieved from Chromaprint revision
`ac31acc8431defbb134ec54eb11daf9146c74170` and KISS FFT revision
`febd4caeed32e33ad8b2e0bb5ea77542c40f18ec`, referenced by the upstream wrapper
repository on 2026-09-04. The npm 0.1.4 archive does not establish the exact
source revisions or complete link configuration used for its precompiled WASM.
Before release, establish that binary's source/build provenance and satisfy
the applicable engine distribution requirements. These notices alone do not
establish that review is complete.
