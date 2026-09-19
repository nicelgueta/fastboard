# FastBoard

A Lightweight app boilerplate to build widget-orientated interfaces

>TradingView widget example
![Trading View example](image.png)

This interface is for building dashboards quickly by creating mini-apps (react components) that are encapsulated as widgets in a homogenous interface. Widgets can talk to each other using various state hooks (recoil) and standardised configuration to allow for rapid development.

This project was inspired by common data serving applications that have the ability to metamorphose into different dashboards depending on the command sent to the application.

## Query engines

Table widgets and the code editor can run on either of two in-browser engines, picked per table:

- **DuckDB** (duckdb-wasm): SQL. Uploads CSV, JSON and Parquet.
- **qpl** (the [qpl](../qpl) interpreter compiled to wasm): the `qpl` editor language. Uploads CSV and Parquet, which are decoded in JS (papaparse, hyparquet) and handed to qpl as Arrow. It runs in a Web Worker. The table widget's Filter is not available for qpl tables; filter with a qpl query in the editor instead.

### Setting up qpl

FastBoard links the wasm build from a sibling checkout of the qpl repo (`"qpl": "link:../qpl/tools/wasm/pkg"` in package.json), so before `yarn install` / `yarn dev`:

```bash
# next to this repo
git clone <qpl repo> ../qpl
make -C ../qpl wasm      # slow the first time: builds a patched Polars for wasm
```

Rebuilding the wasm is picked up without reinstalling. Tests that exercise the real interpreter (`src/data/qpl/wasm.test.ts`) skip themselves when the package isn't built.

TBD...