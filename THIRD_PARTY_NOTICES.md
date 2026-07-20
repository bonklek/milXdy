# Third-Party Notices

milXdy's original code is licensed under the Viral Public License in `LICENSE`.
The components below retain their own licenses. Those licenses apply to the
components themselves and are not replaced by milXdy's VPL.

| Component | Version | Use in distributed builds | License |
| --- | --- | --- | --- |
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
