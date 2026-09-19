/**
 * Catalog contracts for the 3D graph explorer.
 *
 * Mirrors the DataSource pattern in src/data/types.ts: the widget is written
 * against `CatalogSource`, and the duckdb-backed one is just the reference
 * implementation - a remote data catalog can be plugged in the same way.
 * Dependency-free so registry.ts / config.ts can import it without pulling in
 * duckdb or three.
 */

export interface CatalogNode {
  id: string;
  label: string;
  kind: 'database' | 'schema' | 'table' | 'column' | 'dataset' | string;
  meta?: Record<string, unknown>;
}

export interface CatalogLink {
  source: string;
  target: string;
  relation: string;
}

export interface CatalogGraph {
  nodes: CatalogNode[];
  links: CatalogLink[];
}

/** Implement to plug a catalog in. Mirrors the DataSource pattern from Phase 5. */
export interface CatalogSource {
  readonly id: string;
  readonly label: string;
  getGraph(): Promise<CatalogGraph>;
  /** Optional lazy expansion when a node is double-clicked. Returns nodes/links to merge in. */
  expand?(nodeId: string): Promise<CatalogGraph>;
}
