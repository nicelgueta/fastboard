/**
 * The second argument of ag-grid's infinite-row-model `successCallback`: the
 * total number of rows, or undefined when it isn't known.
 *
 * It should be given with *every* block. Withholding it until a block reaches
 * the end of the data (as this used to) leaves the grid not knowing how many
 * rows there are: the pager reads "1 to 25 of more" and only offers a Next
 * button after the user has scrolled far enough to discover the end.
 */
export function lastRowFor(totalRows: number | undefined): number | undefined {
    return typeof totalRows === 'number' && Number.isFinite(totalRows) && totalRows >= 0 ? totalRows : undefined;
}
