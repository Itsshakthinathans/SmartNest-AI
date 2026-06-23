# Auto Nest Restoration & Re-Nest Workflow Report

This report documents the implementation of the **Auto Nest Restoration & Re-Nest Workflow** for SmartNest AI. The feature allows users to switch safely between automatically nested layouts and manual edits, without modifying the underlying nesting placement logic.

---

## 1. Workflow Architecture

To support switching between layouts without modifying the nesting engine or its coordinate stabilizers, we introduced a double-layout preservation strategy:
- **`original_layout.json` / `original_layout.svg`**: Immutable reference files that capture the original, auto-generated nesting configuration when a job first runs or is regenerated.
- **`nested_output.json` / `nested_output.svg`** (referred to as `current_layout`): The editable working copy loaded by the interactive editor and preview canvas.

### Layout State Management
We introduced a `layout_source` field in the database (`nest_jobs` table) to track the active layout state. The field can transition between three states:
1. **`AUTO NEST`**: The layout is exactly as originally auto-generated.
2. **`MANUAL EDIT`**: The user entered edit mode, moved or rotated parts, and saved the changes.
3. **`REGENERATED AUTO NEST`**: A fresh auto-nest layout was generated.

---

## 2. Reset Flow

The reset flow allows users to discard manual coordinate adjustments and return to the original auto nest.

### Execution Flow:
1. The user clicks the **🔄 Reset To Auto Nest** button on the results UI.
2. The frontend triggers `POST /api/nesting/reset/:jobId`.
3. The backend:
   - Locates the original files (`original_layout.json` and `original_layout.svg`) in the job results folder.
   - Copies them over the active layout files (`nested_output.json` and `nested_output.svg`).
   - Reads the original layout source state from the metadata inside `original_layout.json` (either `AUTO NEST` or `REGENERATED AUTO NEST`).
   - Updates the job database record `layout_source` to the original value.
4. The frontend refreshes the workspace preview immediately, reflecting the original layout.

---

## 3. Re-Generate Flow

The re-generate flow lets users re-run nesting calculations using the original parameters.

### Execution Flow:
1. The user clicks the **⚡ Re-Generate Nest** button on the results UI.
2. The frontend triggers `POST /api/nesting/regenerate/:jobId`.
3. The backend:
   - Fetches the job parameter details (`project_id`, `sheet_width`, `sheet_height`, `remnant_id`, `optimization_level`) from the database.
   - Fetches the active project files list from the database.
   - Sets the job status back to `'processing'`.
   - Asynchronously executes `runNestingInBackground` with the `isRegenerate` flag set to `true`.
4. The background runner:
   - Recalculates placements using the existing nesting engine.
   - Overwrites active files (`nested_output.json`, `nested_output.svg`) with the new layout.
   - Overwrites the reference files (`original_layout.json`, `original_layout.svg`) with the newly generated layout.
   - Updates the database status to `'completed'` and `layout_source` to `'REGENERATED AUTO NEST'`.
5. The frontend polls for status completion and reloads the preview immediately upon completion.

---

## 4. Verification & Regression Protection Results

Verification was performed successfully using the 20-part validation dataset, ensuring full regression protection:

### Verification Summary:
- **Test 1 (Manual Edit & Reset)**: Verified that clicking "Manual Nest Adjustment", moving a part, and saving updates `layout_source` to `'MANUAL EDIT'`. Clicking "Reset To Auto Nest" restores the layout and reverts the status to `'AUTO NEST'`.
- **Test 2 (Re-Generate Nest)**: Verified that clicking "Re-Generate Nest" triggers the nesting workflow asynchronously, finishes calculation, and updates `layout_source` to `'REGENERATED AUTO NEST'`.
- **Test 3 (Manual Edit Protection)**: Verified that saved manual layouts persist across page refreshes, and resetting them restores the correct auto layout (both for initially generated and regenerated layouts).
- **Core Nesting Engine Integrity**: Fully preserved. No placement algorithms, deepnest environment setups, NFPs, optimization algorithms, or visual preprocessors were modified.
- **Export Center Compatibility**: Confirmed that PDF, SVG, and JSON exports continue to operate using the active layout copy.
