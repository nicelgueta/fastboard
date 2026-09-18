# revamp plan

Come up with a design/plan to revamp this web template into a fully functional tool. This plan should be designed to be executed by subagent(s) so provide the necessary context/tooling to enable that. do the research for each piece to provide subagents with everything they need to just focus on implementation.

We need: 
- Replace the top search based navigation into tool select dropdowns (with their own integrated search) 
- an intro modal to explain how to use the tool
- appearance/theme configurations:
    - dark/light - default dark



## New widgets
- a data table widget (ag grid) with the following configurations:
    - a data source (which itself is configured with columns and datatypes)
    - filters (using expression builder)
    - expression builder requirements:
        - modal
        - supports all common operators, inc contains, like, in and their negative opposites
        - nested and or logic
        - button to add/remove a field
        - field should be a dropdown select which then two new fields appear (operator and value). 
        - datatypes should support categoricals in which case the value should itself be a dropdown
    - define an api interface that any data soruce should implement to provide the front-end with the necessary configuration to create the expression builder and also to recieve the expression statement. 
    - supports data ingestion via csv, json and parquet (suggest using duckdb wasm) for this
    - paginated with options for page size
- integrated code editor
    - monaco theme
    - includes syntax highighting for common languages. 
    - supports duckdb wasm and able to link to a table widget and query that table.
- framework to link widgets together
    - each widget has an id
    - widgets can use global hooks to find widgets and able to filter by type
    - 
- 3d graph explorer - used for browsing data catalogs via entity relationships


- a front page to the tool with a stylish three.js 3d background. theme should be cartoonish flying shapes on a dark background. shapes should be responsive to mouse movements by moving out of the way of the cursor

