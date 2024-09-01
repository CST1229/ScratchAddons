import { init, callbacks, SMALL_GAP, BIG_GAP, sharedData } from "../data-category-tweaks-v2/module.js";
import { updateAllBlocks } from "../../libraries/common/cs/update-all-blocks.js";

export default async function ({ addon, console }) {
  const ScratchBlocks = await addon.tab.traps.getBlockly();
  const vm = addon.tab.traps.vm;

  const FOLDER_REGEX = /^\[([^\]]+)\] (.+)$/;

  let collapseByDefault = addon.settings.get("collapseByDefault");

  const folderToVarName = (name, folderName) => {
    const match = name.match(FOLDER_REGEX);
    if (!match) {
      if (!folderName) return name;
      return `[${folderName}] ${name}`;
    }
    if (!folderName) return match[1];
    return `[${folderName}] ${match[1]}`;
  };
  const splitVarName = (name) => {
    const match = name.match(FOLDER_REGEX);
    if (!match) return ["", name];
    return [match[1], match[2]];
  };
  const folderFromVarName = (name) => {
    return splitVarName(name)[0];
  };
  const nameFromVarName = (name) => {
    return splitVarName(name)[1];
  };

  const renameVariable = (varId, newName, withoutGroup = false, target = null) => {
    const ws = addon.tab.traps.getWorkspace();
    const blocklyVar = ws?.getVariableById(varId);
    if (blocklyVar) {
      // if the variable is present in the editing target or is global, rename it through Blockly
      if (withoutGroup) {
        renameVariableUngrouped(ws, blocklyVar, newName);
      } else {
        ws.variableMap_.renameVariable(blocklyVar, newName);
      }
    } else if (target && Object.hasOwnProperty(target.variables, varId)) {
      // rename it through the VM, if the variable and target exists
      target.renameVariable(varId, newName);
    }
  };

  // Blockly.VariableMap.prototype.renameVariable but it doesn't create an undo group
  const renameVariableUngrouped = function (ws, variable, newName) {
    var type = variable.type;
    var conflictVar = ws.variableMap_.getVariable(newName, type);
    var blocks = ws.getAllBlocks();
    if (!conflictVar) {
      ws.variableMap_.renameVariableAndUses_(variable, newName, blocks);
    } else {
      // We don't want to rename the variable if one with the exact new name
      // already exists.
      console.warn(
        "Unexpected conflict when attempting to rename " +
          "variable with name: " +
          variable.name +
          " and id: " +
          variable.getId() +
          " to new name: " +
          newName +
          ". A variable with the new name already exists" +
          " and has id: " +
          conflictVar.getId()
      );
    }
  };

  const getFolderCollapsed = (target, type, name) => {
    if (!target._foldersCollapsed) target._foldersCollapsed = Object.create(null);
    // Lists are in a separate category, so add type to differentiate collapsed list and variable folders
    return !!(target._foldersCollapsed[type + "_" + name] ?? collapseByDefault);
  };
  const setFolderCollapsed = (target, type, name, collapsed) => {
    if (!target._foldersCollapsed) target._foldersCollapsed = Object.create(null);
    target._foldersCollapsed[type + "_" + name] = collapsed;
  };

  // process the data category and add folders into it
  const turnIntoFolders = (vars, ws) => {
    if (!addon || addon.self.disabled) {
      return vars;
    }

    const makeButtonFor = (text, isLocal, isGlobal, folderType) => {
      const label = document.createElement("button");
      label.setAttribute("text", text);
      label.setAttribute("sa-folder-name", text);
      label.setAttribute("sa-local-folder", isLocal);
      label.setAttribute("sa-global-folder", isGlobal);
      label.setAttribute("sa-folder-type", folderType);
      return label;
    };

    const folders = {};
    const localFolders = {};
    const localNotInFolder = [];
    const notInFolder = [];

    for (const el of vars) {
      // is a variable reporter
      if (el.hasAttribute("id")) {
        const id = el.getAttribute("id");
        const variable = ws.getVariableById(id);
        const folder = folderFromVarName(variable.name);

        const local = variable.isLocal;
        const consideredLocal = !sharedData.separateLocalVariables || local;
        const consideredGlobal = !sharedData.separateLocalVariables || !local;

        if (!folder) {
          if (local && sharedData.separateLocalVariables) {
            localNotInFolder.push(el);
          } else {
            notInFolder.push(el);
          }
        } else {
          const objFolder = variable.type + "_" + folder;
          const foldersObj = sharedData.separateLocalVariables ? (local ? localFolders : folders) : folders;
          if (!(objFolder in foldersObj)) {
            foldersObj[objFolder] = { vars: [], collapsed: false, name: folder };
            if (consideredLocal) foldersObj[objFolder].collapsed ||= getFolderCollapsed(vm.editingTarget, variable.type, folder);
            if (consideredGlobal)
              foldersObj[objFolder].collapsed ||= getFolderCollapsed(vm.runtime.getTargetForStage(), variable.type, folder);
          }
          foldersObj[objFolder].vars.push(el);
        }
      }
    }

    let varType = "";

    let newCat = [];
    const pushFolders = (foldersObj, isLocal, isGlobal) => {
      for (const folder in foldersObj) {
        newCat.push(makeButtonFor(foldersObj[folder].name, isLocal, isGlobal, varType));
        if (!foldersObj[folder].collapsed) {
          for (const v of foldersObj[folder].vars) {
            newCat.push(v);
            v.setAttribute("gap", SMALL_GAP);
            v.setAttribute("sa-in-folder", "");
            if (foldersObj[folder].vars[0] === v) v.setAttribute("sa-first-in-folder", "");
          }
        }
      }
    };
    for (const el of vars) {
      // list reporter. we're now in the list category
      if (el.getAttribute("type") === "data_listcontents") {
        varType = "list";
      }
      // variable reporter. we add those ourselves
      if (el.hasAttribute("id")) {
        continue;
      }

      newCat.push(el);

      // create variable button.
      // add the folders and variables after this
      // if local variables aren't separated
      if (!sharedData.separateLocalVariables && el.hasAttribute("callbackkey")) {
        pushFolders(folders, true, true);

        newCat = newCat.concat(notInFolder);
        const lastEl = newCat[newCat.length - 1];
        if (lastEl) lastEl.setAttribute("gap", BIG_GAP);
        continue;
      }

      // separation label added by data category tweaks.
      // add this label, then the scope's variables
      if (el.tagName === "LABEL" && el.hasAttribute("data")) {
        const local = el.getAttribute("data") === "for-this-sprite-only";
        if (local) {
          pushFolders(localFolders, true, false);
          newCat = newCat.concat(localNotInFolder);
        } else {
          pushFolders(folders, false, true);
          newCat = newCat.concat(notInFolder);
        }
        continue;
      }
    }
    return newCat;
  };

  function getAllFolders() {
    const ws = addon.tab.traps.getWorkspace();
    const folders = new Set();
    if (!ws) return folders;
    for (const variable of ws.getAllVariables()) {
      // Broadcasts are considered variables, but they can't be put into folders by this addon
      if (variable.type !== "" && variable.type !== "list") continue;
      const folderName = folderToVarName(variable.name);
      if (folderName) folders.add(folderName);
    }
    return folders;
  }
  function applyFolderComboBox() {
    debugger;
    const input = document.querySelector("[class*='prompt_body'] > div > input[class*='prompt_variable-name-text-input']");
    if (!input) return;
    const datalist = document.createElement("datalist");
    datalist.id = "sa-folders";
    for (const folder of getAllFolders()) {
      const item = document.createElement("option");
      item.value = folder;
      datalist.appendChild(item);
    }
    input.parentElement.appendChild(datalist);
    input.setAttribute("list", datalist.id);
  }

  callbacks.varFolders = turnIntoFolders;
  await init(addon);

  addon.tab.createBlockContextMenu(
    (items, block) => {
      if (!addon || addon.self.disabled) return;
      if (block.getCategory() !== "data" && block.getCategory() !== "data-lists") return;

      const variable = block.workspace.getVariableById(block.getVars()[0]);
      if (variable) {
        const split = splitVarName(variable.name);
        const alreadyInFolder = !!split[0];
        const varName = split[1];

        // TODO: l10n
        const menuText = alreadyInFolder ? "Move to other folder" : "Add to folder";
        const modalCaption = alreadyInFolder ? "Move to Other Folder" : "Add to Folder";
        const modalMessage = alreadyInFolder ? "Folder to move to:" : "Folder to add to:";

        items.push({
          enabled: true,
          separator: true,
          text: menuText,
          callback: () => {
            ScratchBlocks.prompt(
              modalMessage,
              "",
              (_folder) => {
                if (!_folder) return;
                renameVariable(variable.getId(), folderToVarName(varName, _folder));
                block.workspace.refreshToolboxSelection_();
              },
              modalCaption,
              // the broadcast variable type has no extra buttons, so we use it
              "broadcast_msg"
            );
            applyFolderComboBox();
          },
        });
        // TODO: l10n
        if (alreadyInFolder) {
          items.push({
            enabled: true,
            separator: false,
            text: "Remove from folder",
            callback: () => {
              renameVariable(variable.getId(), folderToVarName(varName, ""), false);
              block.workspace.refreshToolboxSelection_();
            },
          });
        }
      }
      return items;
    },
    {
      flyout: true,
      blocks: true,
    }
  );

  const RIGHT = "▶︎";
  const DOWN = "▼";

  ScratchBlocks.FlyoutButton = class SAFlyoutButton extends ScratchBlocks.FlyoutButton {
    constructor(workspace, targetWorkspace, xml, isLabel) {
      super(workspace, targetWorkspace, xml, xml.hasAttribute("sa-folder-name") ? true : isLabel);

      if (xml.hasAttribute("sa-folder-name")) {
        this.saFolderButton = true;
        this.saFolderName = xml.getAttribute("sa-folder-name") || "";

        this.saFolderType = xml.getAttribute("sa-folder-type");
        // these variables are used for seeing which folders to modify,
        // if there are folders with the same name in the stage and sprite
        // (if separate local variables is enabled, local and global folders
        // are separated, otherwise they are merged)
        this.saLocalFolder = xml.getAttribute("sa-local-folder") === "true";
        this.saGlobalFolder = xml.getAttribute("sa-global-folder") === "true";
        this.callback_ = () => {
          if (this.saLocalFolder) {
            setFolderCollapsed(
              vm.editingTarget,
              this.saFolderType,
              this.saFolderName,
              !getFolderCollapsed(vm.editingTarget, this.saFolderType, this.saFolderName)
            );
          }
          if (this.saGlobalFolder) {
            const stage = vm.runtime.getTargetForStage();
            setFolderCollapsed(stage, this.saFolderType, this.saFolderName, !getFolderCollapsed(stage, this.saFolderType, this.saFolderName));
          }
          targetWorkspace.refreshToolboxSelection_();
        };

        this.saCollapsed = false;
        if (this.saLocalFolder) {
          this.saCollapsed ||= getFolderCollapsed(vm.editingTarget, this.saFolderType, this.saFolderName);
        }
        if (this.saGlobalFolder) {
          this.saCollapsed ||= getFolderCollapsed(vm.runtime.getTargetForStage(), this.saFolderType, this.saFolderName);
        }
      }

      this.isLabel_ = isLabel;
      this.saMouseDownWrapper_ = null;
    }

    addTextSvg(isLabel) {
      super.addTextSvg(isLabel);

      if (!this.saFolderButton) return;
      if (isLabel) return;

      const g = this.svgGroup_;
      const shadow = g.children[0];
      const rect = g.children[1];
      const svgText = g.children[2];
      let text = g.children[3];

      svgText.textContent = this.saCollapsed ? RIGHT : DOWN;

      this.height = 25;
      this.width = this.height;

      if (!text) {
        text = ScratchBlocks.utils.createSvgElement(
          "text",
          {
            class: "blocklyFlyoutLabelText",
            x: this.width + 8,
            y: this.height / 2,
            "text-anchor": "left",
            "dominant-baseline": "central",
          },
          this.svgGroup_
        );
      }
      text.textContent = this.text_;

      // the shadow is fully transparent;
      // this is to expand the button's bounding box
      shadow.setAttribute("width", 310);
      shadow.setAttribute("height", this.height);

      rect.setAttribute("width", this.width);
      rect.setAttribute("height", this.height);

      svgText.setAttribute("text-anchor", "middle");
      svgText.setAttribute("dominant-baseline", "central");
      svgText.setAttribute("dy", "0");
      svgText.setAttribute("x", this.width / 2);
      svgText.setAttribute("y", this.height / 2);
    }

    createDom() {
      const group = super.createDom();
      this.saMouseDownWrapper_ = ScratchBlocks.bindEventWithChecks_(
        this.svgGroup_,
        "mousedown",
        this,
        this.onSAMouseDown_
      );
      return group;
    }

    onSAMouseDown_(e) {
      if (!ScratchBlocks.utils.isRightButton(e)) return;
      // the flyout listens for a mousedown gesture, which removes our context menu.
      // workaround this by creating it a bit later
      setTimeout(() => {
        const menuOptions = [];

        menuOptions.push({
          text: "Rename folder",
          enabled: true,
          callback: () => {
            // TODO: l10n
            ScratchBlocks.prompt(
              "Rename this folder to:",
              this.saFolderName,
              (newName) => {
                if (!newName || this.saFolderName === newName) return;

                const ws = this.workspace_;
                // TODO: rename folders in other sprites?
                // TODO: handle variable name conflicts?
                const vars = ws.variableMap_.getVariablesOfType(this.saFolderType);
                ScratchBlocks.Events.setGroup(true);
                for (const variable of vars) {
                  // with separated sprite-only variables, only rename variables of the same scope
                  // (as they appear to be in a separate folder with it enabled)
                  if (!(variable.isLocal && this.saLocalFolder) && !(!variable.isLocal && this.saGlobalFolder))
                    continue;
                  if (folderFromVarName(variable.name) !== this.saFolderName) continue;
                  const varName = nameFromVarName(variable.name);
                  renameVariable(variable.getId(), folderToVarName(varName, newName), true);
                }
                ScratchBlocks.Events.setGroup(false);
                ws.refreshToolboxSelection_();
              },
              // TODO: l10n
              "Rename Folder",
              // the broadcast variable type has no extra buttons, so we use it
              "broadcast_msg"
            );
          },
        });

        // TODO: l10n
        menuOptions.push({
          text: "Delete folder",
          enabled: true,
          callback: () => {
            // TODO: delete folders in other sprites?
            const ws = this.workspace_;
            const vars = ws.variableMap_.getVariablesOfType(this.saFolderButton);
            ScratchBlocks.Events.setGroup(true);
            for (const variable of vars) {
              // with separated sprite-only variables, only rename variables of the same scope
              // (as they appear to be in a separate folder with it enabled)
              if (!(variable.isLocal && this.saLocalFolder) && !(!variable.isLocal && this.saGlobalFolder)) continue;
              if (folderFromVarName(variable.name) !== this.saFolderName) continue;
              const varName = nameFromVarName(variable.name);
              renameVariable(variable.getId(), folderToVarName(varName, ""), true);
            }
            ScratchBlocks.Events.setGroup(false);
            ws.refreshToolboxSelection_();
          },
        });

        ScratchBlocks.ContextMenu.show(e, menuOptions, this.workspace_.RTL, true);
        ScratchBlocks.ContextMenu.currentBlock = null;
      }, 1);
    }

    dispose() {
      if (this.saMouseDownWrapper_) {
        ScratchBlocks.unbindEvent_(this.saMouseDownWrapper_);
      }
      return super.dispose();
    }
  };

  const oldDomToBlock = ScratchBlocks.Xml.domToBlock;
  ScratchBlocks.Xml.domToBlock = function (xmlBlock, workspace) {
    const block = oldDomToBlock(xmlBlock, workspace);
    if (xmlBlock.hasAttribute && xmlBlock.hasAttribute("sa-in-folder")) {
      block.saInFolder = true;
    }
    if (xmlBlock.hasAttribute && xmlBlock.hasAttribute("sa-first-in-folder")) {
      block.saFirstInFolder = true;
    }
    return block;
  };

  const oldCreateCheckbox = ScratchBlocks.VerticalFlyout.prototype.createCheckbox_;
  ScratchBlocks.VerticalFlyout.prototype.ACTUAL_CHECKBOX_SIZE = ScratchBlocks.VerticalFlyout.prototype.CHECKBOX_SIZE;
  ScratchBlocks.VerticalFlyout.prototype.INDENT_WIDTH = 30;
  ScratchBlocks.VerticalFlyout.prototype.INDENT_START = ScratchBlocks.VerticalFlyout.prototype.ACTUAL_CHECKBOX_SIZE / 2;
  ScratchBlocks.VerticalFlyout.prototype.createCheckbox_ = function (block, cursorX, cursorY, blockHW) {
    const inFolder = !!block.saInFolder;
    const extraX = this.INDENT_WIDTH * +inFolder;

    this.CHECKBOX_SIZE = this.ACTUAL_CHECKBOX_SIZE;
    oldCreateCheckbox.call(this, block, cursorX + extraX, cursorY, blockHW);

    // blocks after the first block in a folder get a taller indent
    const extraHeight = !!block.saFirstInFolder ? 0 : blockHW.height / 2 - 4;

    if (!inFolder) return;

    const check = this.checkboxes_[block.id];
    ScratchBlocks.utils.createSvgElement(
      "path",
      {
        class: "sa-variable-folder-indent",
        x: -((this.CHECKBOX_SIZE + 2) / 2) + "px",
        y: "0px",
        d: `m0,${this.CHECKBOX_SIZE / 2} l${-(this.INDENT_WIDTH - this.INDENT_START)},0 l0,${-(
          blockHW.height / 2 +
          SMALL_GAP +
          4 +
          extraHeight
        )}`,
      },
      check.svgRoot
    );

    // this is kind of a hack to offset the block to account for the indent
    this.CHECKBOX_SIZE = this.ACTUAL_CHECKBOX_SIZE + extraX;
  };

  let hideFolderInPalette = addon.settings.get("hideFolderInPalette");
  let hideFolderInWorkspace = addon.settings.get("hideFolderInWorkspace");
  addon.settings.addEventListener("change", () => {
    let refreshToolbox = false;

    const _hideFolderInPalette = addon.settings.get("hideFolderInPalette");
    const _hideFolderInWorkspace = addon.settings.get("hideFolderInWorkspace");
    const _collapseByDefault = addon.settings.get("collapseByDefault");
    if (collapseByDefault !== _collapseByDefault) {
      collapseByDefault = _collapseByDefault;
      refreshToolbox = true;
    }
    if (hideFolderInPalette !== _hideFolderInPalette) {
      hideFolderInPalette = _hideFolderInPalette;
      refreshToolbox = true;
    }
    if (hideFolderInWorkspace !== _hideFolderInWorkspace) {
      hideFolderInWorkspace = _hideFolderInWorkspace;
      updateAllBlocks(addon.tab, { updateMainWorkspace: true, updateFlyout: false, updateCategories: false });
    }

    if (refreshToolbox) addon.tab.traps.getWorkspace().refreshToolboxSelection_();
  });

  const oldGetText = ScratchBlocks.FieldVariableGetter.prototype.getText;
  ScratchBlocks.FieldVariableGetter.prototype.getText = function () {
    const text = oldGetText.call(this);
    if (!text || addon.self.disabled) return text;
    const isInFlyout = this.sourceBlock_?.isInFlyout;
    if ((hideFolderInPalette && isInFlyout) || (hideFolderInWorkspace && !isInFlyout)) {
      return nameFromVarName(text);
    }
    return text;
  };
  const oldGetDisplayText = ScratchBlocks.FieldVariableGetter.prototype.getDisplayText_;
  ScratchBlocks.FieldVariableGetter.prototype.getDisplayText_ = function () {
    const oldText = this.text_;
    this.text_ = this.getText();
    const returnValue = oldGetDisplayText.call(this);
    this.text_ = oldText;
    return returnValue;
  };

  addon.tab.traps.getWorkspace().refreshToolboxSelection_();
  const onDisableEnable = () => {
    addon.tab.traps.getWorkspace().refreshToolboxSelection_();
    if (hideFolderInWorkspace)
      updateAllBlocks(addon.tab, { updateMainWorkspace: true, updateFlyout: false, updateCategories: false });
  };
  addon.self.addEventListener("disabled", onDisableEnable);
  addon.self.addEventListener("reenabled", onDisableEnable);
}
