const identity = (i) => i;

// addon APIs
// data-category-tweaks-v2
let dct,
  dctMsg = identity,
  dctSafeMsg = identity;
// variable-folders
let varFolders,
  varFoldersMsg = identity,
  varFoldersSafeMsg = identity;

// either of the 2 addon's APIs -
// for functions that only need stuff like traps
let addon;

// Used in setting change handler. Updated in getBlocksXML.
// (Yes this is weird but it's how it was originally and I'm too scared to change it)
let hasSeparateListCategory = false;

const SMALL_GAP = 8;
const BIG_GAP = 24;

const LAST_LINE_REGEX = /(?:\n|^).*$/;
const COMMENT_MARKER = " // _variable_folders_";
const COMMENT_HEADER = `This comment contains configuration for variable folders in third-party editors\nYou can move, resize and collapse this comment, but do not edit it by hand`;

let ScratchBlocks, vm;

const separateVariablesByType = (toolboxXML) => {
  const listButtonIndex = toolboxXML.findIndex(
    (i) => i.getAttribute("callbackkey") === "CREATE_LIST" || i.getAttribute("type") === "data_addtolist"
  );
  return {
    variables: toolboxXML.slice(0, listButtonIndex),
    lists: toolboxXML.slice(listButtonIndex, toolboxXML.length),
  };
};

const separateLocalVariables = (workspace, toolboxXML) => {
  const { variables, lists } = separateVariablesByType(toolboxXML);

  const makeLabel = (l10n) => {
    const label = document.createElement("label");
    label.setAttribute("text", dctMsg(l10n));
    return label;
  };

  const fixGaps = (variables) => {
    if (variables.length > 0) {
      for (var i = 0; i < variables.length - 1; i++) {
        variables[i].setAttribute("gap", SMALL_GAP);
      }
      variables[i].setAttribute("gap", BIG_GAP);
    }
  };

  const separateVariablesByScope = (xml) => {
    const before = [];
    const global = [];
    const local = [];
    const after = [];

    for (const blockXML of xml) {
      if (blockXML.hasAttribute("id")) {
        const id = blockXML.getAttribute("id");
        const variable = workspace.getVariableById(id);
        if (!variable || !variable.isLocal) {
          global.push(blockXML);
        } else {
          local.push(blockXML);
        }
      } else if (global.length || local.length) {
        after.push(blockXML);
      } else {
        before.push(blockXML);
      }
    }

    const result = before;

    if (global.length) {
      result.push(makeLabel("for-all-sprites"));
      fixGaps(global);
      result.push(...global);
    }

    if (local.length) {
      result.push(makeLabel("for-this-sprite-only"));
      fixGaps(local);
      result.push(...local);
    }

    return result.concat(after);
  };

  return separateVariablesByScope(variables).concat(separateVariablesByScope(lists));
};

const moveReportersDown = (toolboxXML) => {
  const { variables, lists } = separateVariablesByType(toolboxXML);

  const moveReportersToEnd = (xml) => {
    const reporters = [];
    const everythingElse = [];

    for (const blockXML of xml) {
      if (blockXML.hasAttribute("id") || blockXML.tagName === "BUTTON") {
        // Round reporters and the create variable button
        reporters.push(blockXML);
      } else {
        // Everything else like "change variable by 1"
        everythingElse.push(blockXML);
      }
    }

    if (everythingElse.length) {
      everythingElse[everythingElse.length - 1].setAttribute("gap", BIG_GAP);
    }

    return everythingElse.concat(reporters);
  };

  return moveReportersToEnd(variables).concat(moveReportersToEnd(lists));
};

const getFoldersComment = (forStage) => {
  const target = forStage ? vm.runtime.getTargetForStage() : vm.editingTarget;
  if (!target) return null;
  for (const id in target.comments) {
    if (target.comments[id].text.endsWith(COMMENT_MARKER)) return comment;
  }
  return null;
}
const createFoldersComment = (forStage) => {
  const target = forStage ? vm.runtime.getTargetForStage() : vm.editingTarget;
  if (!target) return null;
  const existingComment = getFoldersComment(forStage);
  if (existingComment) return existingComment;

  const id = Math.random() + "";
  const text = `${COMMENT_HEADER}\n{}${COMMENT_MARKER}`;

  target.createComment(
    // comment ID, just has to be a random string
    id,
    // block ID
    null,
    // text
    text,
    // x, y, width, height
    50,
    -150,
    350,
    150,
    // minimized
    false
  );
  return target.comments[id];
}

const getFoldersData = (forStage) => {
  const comment = getFoldersComment(forStage);
  if (!comment) return {};
  const lastLine = comment.text.match(LAST_LINE_REGEX);
  const json = lastLine.substring(0, lastLine.length - LAST_LINE_REGEX.length);
  try {
    return JSON.parse(json);
  } catch (e) {
    return {};
  }
}

const setFoldersData = (forStage, data) => {
  const comment = createFoldersComment(forStage);
  if (!comment) return;
  comment.text = comment.text.replace(LAST_LINE_REGEX, `\n${JSON.stringify(data)}${COMMENT_MARKER}`);
}

const getFolderForVar = (id) => {
	const v = workspace.getVariableById(id);
	if (!v) return null;
	const local = v.isLocal;
	const foldersData = getFoldersData(!local);
	if (!foldersData) return null;

	for (const name in foldersData) {
		const vars = foldersData[name].variables;
		if (!vars || !Array.isArray(vars)) continue;
		for (const varId of vars) {
			if (varId === id) return name;
		}
	}
	return null;
};

const turnIntoFolders = (vars) => {
  if (!varFolders || !varFolders.self.disabled) {
    return vars;
  }

  const makeLabel = (text) => {
    const label = document.createElement("label");
    label.setAttribute("text", text);
    return label;
  };

  const folders = {};
  const notInFolder = [];

  for (const el of vars) {
    if (el.hasAttribute("id")) {
      const folder = getFolderForVar(el.getAttribute("id"));
	  if (folder === null) {
		notInFolder.push(el);
	  } else {
		if (!folders[folder]) folders[folder] = [];
		folders[folder].push(el);
	  }
    }
  }

  let newVars = [];
  let addedVars = false;
  for (const el of vars) {
	if (el.hasAttribute("id") || el.tagName === "LABEL") {
		if (!addedVars) {
			addedVars = true;
			for (const folder in folders) {
				newVars.push(makeLabel(folder));
				for (const v of folders[folder]) {
					newVars.push(el);
				}
			}
			newVars = newVars.concat(notInFolder);
		}
	} else {
		newVars.push(el);
	}
  }
  return newVars;
};

export async function init(anAddon) {
  if (addon) return;
  addon = anAddon;

  ScratchBlocks = await addon.tab.traps.getBlockly();
  vm = addon.tab.traps.vm;

  const DataCategory = ScratchBlocks.DataCategory;
  let variableCategory;
  let listCategory;
  const variableCategoryCallback = (workspace) => {
    let result = DataCategory(workspace);

    if (dct && !dct.self.disabled && dct.settings.get("moveReportersDown")) {
      result = moveReportersDown(result);
    }

    if (dct && !dct.self.disabled && dct.settings.get("separateLocalVariables")) {
      result = separateLocalVariables(workspace, result);
    }

    if (!hasSeparateListCategory || !dct || dct.self.disabled) {
      return turnIntoFolders(result);
    }

    const { variables, lists } = separateVariablesByType(result);
    variableCategory = turnIntoFolders(variables);
    listCategory = turnIntoFolders(lists);
    return variableCategory;
  };
  const listCategoryCallback = () => {
    // Computed in variable category callback, which should be called before this method.
    return listCategory;
  };

  // Each time a new workspace is made, these callbacks are reset, so re-register whenever a flyout is shown.
  // https://github.com/LLK/scratch-blocks/blob/61f02e4cac0f963abd93013842fe536ef24a0e98/core/flyout_base.js#L469
  const oldShow = ScratchBlocks.Flyout.prototype.show;
  ScratchBlocks.Flyout.prototype.show = function (xmlList) {
    this.workspace_.registerToolboxCategoryCallback("VARIABLE", variableCategoryCallback);
    this.workspace_.registerToolboxCategoryCallback("LIST", listCategoryCallback);
    return oldShow.call(this, xmlList);
  };

  // Use Scratch's extension category mechanism to replace the data category with our own.
  // https://github.com/LLK/scratch-gui/blob/ddd2fa06f2afa140a46ec03be91796ded861e65c/src/containers/blocks.jsx#L344
  // https://github.com/LLK/scratch-gui/blob/2ceab00370ad7bd8ecdf5c490e70fd02152b3e2a/src/lib/make-toolbox-xml.js#L763
  // https://github.com/LLK/scratch-vm/blob/a0c11d6d8664a4f2d55632e70630d09ec6e9ae28/src/engine/runtime.js#L1381
  const originalGetBlocksXML = vm.runtime.getBlocksXML;
  vm.runtime.getBlocksXML = function (target) {
    const result = originalGetBlocksXML.call(this, target);
    hasSeparateListCategory = dct ? dct.settings.get("separateListCategory") : false;
    if (dct && !dct.self.disabled && hasSeparateListCategory) {
      result.push({
        id: "data",
        xml: `
		  <category
			name="%{BKY_CATEGORY_VARIABLES}"
			id="variables"
			colour="#FF8C1A"
			secondaryColour="#DB6E00"
			custom="VARIABLE">
		  </category>
		  <category
			name="${dctSafeMsg("list-category")}"
			id="lists"
			colour="#FF661A"
			secondaryColour="#FF5500"
			custom="LIST">
		  </category>`,
      });
    }
    return result;
  };

  // If editingTarget is set, the editor has already rendered and we have to tell it to rerender.
  if (vm.editingTarget) {
    vm.emitWorkspaceUpdate();
  }
}

const dynamicEnableOrDisable = () => {
  // Enabling/disabling is similar to changing settings.
  // If separate list category is enabled, a workspace update is needed.
  // If any other setting is enabled, refresh the toolbox.
  if (dct && dct.settings.get("separateListCategory")) {
    if (vm.editingTarget) {
      vm.emitWorkspaceUpdate();
    }
  }
  if (dct && (dct.settings.get("separateLocalVariables") || dct.settings.get("moveReportersDown"))) {
    const workspace = Blockly.getMainWorkspace();
    if (workspace) {
      workspace.refreshToolboxSelection_();
    }
  }
};

export async function initDCT(anAddon, msg, safeMsg) {
  dct = anAddon;
  dctMsg = msg;
  dctSafeMsg = safeMsg;
  init(anAddon);

  dct.self.addEventListener("disabled", () => {
    dynamicEnableOrDisable();
  });
  dct.self.addEventListener("reenabled", () => {
    dynamicEnableOrDisable();
  });
  dct.settings.addEventListener("change", (e) => {
    // When the separate list category option changes, we need to do a workspace update.
    // For all other options, just refresh the toolbox.
    // Always doing both of these in response to a settings change causes many issues.
    if (dct.settings.get("separateListCategory") !== hasSeparateListCategory) {
      if (vm.editingTarget) {
        vm.emitWorkspaceUpdate();
      }
    } else {
      const workspace = Blockly.getMainWorkspace();
      if (workspace) {
        workspace.refreshToolboxSelection_();
      }
    }
  });
}
export async function initVarFolders(anAddon, msg, safeMsg) {
  varFolders = anAddon;
  varFoldersMsg = msg;
  varFoldersSafeMsg = safeMsg;
  init(anAddon);

  varFolders.self.addEventListener("disabled", () => {
    dynamicEnableOrDisable();
  });
  varFolders.self.addEventListener("reenabled", () => {
    dynamicEnableOrDisable();
  });
}
