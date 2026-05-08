# AQUAScan Research Model Drop Zone

The web app reads `metadata.json` at startup and keeps the heuristic analysis active until a model is explicitly enabled.

To add a real model later:

1. Export the model as ONNX.
2. Place the file in this folder, for example `nighttime-oxygen-trap.onnx`.
3. Copy the ONNX Runtime Web `.wasm` files from `node_modules/onnxruntime-web/dist/` into `public/models/research/ort/`, or change `wasmPaths` in `metadata.json` to the hosted runtime path you want to use.
4. Confirm the model's `inputName`, `outputName`, `featureOrder`, and `outputLabels`.
5. Set that model's `enabled` value to `true`.

The metadata file is the source of truth for feature ordering. If the ONNX model was trained with a different order, update `featureOrder` before enabling it.
