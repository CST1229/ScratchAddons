// things common between data-category-tweaks-v2 and variable-folders
// (mostly data category management stuff so the 2 addons are compatible
// with eachother)

export const SMALL_GAP = 8;
export const BIG_GAP = 24;

let initialized = false;

export const callbacks = {
  variables: null,
  lists: null,
  varFolders: null,
};
export const sharedData = {
  separateLocalVariables: false,
};

export async function init(addon) {
  if (initialized) return;
  initialized = true;

  const ScratchBlocks = await addon.tab.traps.getBlockly();
  const DataCategory = ScratchBlocks.DataCategory;

  // Each time a new workspace is made, these callbacks are reset, so re-register whenever a flyout is shown.
  // https://github.com/LLK/scratch-blocks/blob/61f02e4cac0f963abd93013842fe536ef24a0e98/core/flyout_base.js#L469
  const oldShow = ScratchBlocks.Flyout.prototype.show;
  ScratchBlocks.Flyout.prototype.show = function (xmlList) {
    const varFoldersCallback = callbacks.varFolders ? (cat) => callbacks.varFolders(cat, this.workspace_) : (r) => r;
    this.workspace_.registerToolboxCategoryCallback("VARIABLE", (ws) => {
      if (callbacks.variables) {
        return callbacks.variables(ws, varFoldersCallback);
      }
      return DataCategory(ws);
    });
    // only runs when data-category-tweaks-v2 adds a LIST category
    this.workspace_.registerToolboxCategoryCallback("LIST", (ws) => {
      if (callbacks.lists) {
        return callbacks.lists(ws, varFoldersCallback);
      }
    });
    return oldShow.call(this, xmlList);
  };
}
