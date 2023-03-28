import { init, callbacks, SMALL_GAP, BIG_GAP } from "../data-category-tweaks-v2/module.js";

export default async function ({ addon, msg, safeMsg, console }) {
  const ScratchBlocks = await addon.tab.traps.getBlockly();
  const vm = addon.tab.traps.vm;

  const LAST_LINE_REGEX = /(?:\n|^).*\n*$/;

  const COMMENT_MARKER = " // _variable_folders_";
  const COMMENT_HEADER = `This comment contains configuration for variable folders in third-party editors\nYou can move, resize and collapse this comment, but do not edit it by hand`;

  // Gets the comment where folder data is stored.
  const getFoldersComment = (forStage) => {
    const target = forStage ? vm.runtime.getTargetForStage() : vm.editingTarget;
    if (!target) return null;
    return Object.values(target.comments).find((c) => c.text.endsWith(COMMENT_MARKER));
  };
  // Creates a folder data comment if it doesn't already exist,
  // and returns it.
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
  };

  const getFoldersData = (forStage) => {
    const comment = getFoldersComment(forStage);
    if (!comment) return {};
    const lastLine = comment.text.match(LAST_LINE_REGEX);
    if (!lastLine) return {};
    const json = lastLine[0].trim().substring(0, lastLine[0].length - COMMENT_MARKER.length);
    try {
      return JSON.parse(json);
    } catch (e) {
      return {};
    }
  };

  const setFoldersData = (forStage, data) => {
    const comment = createFoldersComment(forStage);
    if (!comment) return;
    comment.text = comment.text.replace(LAST_LINE_REGEX, `\n${JSON.stringify(data)}${COMMENT_MARKER}`);
  };

  const getFolderForVar = (id) => {
    const workspace = ScratchBlocks.getMainWorkspace();
    const v = workspace.getVariableById(id);
    if (!v) return null;
    const local = v.isLocal;
    const foldersData = getFoldersData(!local);

    for (const name in foldersData) {
      const vars = foldersData[name].variables;
      if (!vars || !Array.isArray(vars)) continue;
      for (const varId of vars) {
        if (varId === id) return name;
      }
    }
    return null;
  };

  // Process the data category and add folders into it.
  const turnIntoFolders = (vars) => {
    if (!addon || addon.self.disabled) {
      return vars;
    }

    const makeButtonFor = (text) => {
      const label = document.createElement("button");
      label.setAttribute("text", text);
      label.setAttribute("sa-folder-name", text);
      return label;
    };

    const folders = {};
    const notInFolder = [];

    const data = getFoldersData(false);
    const globalData = getFoldersData(true);

    for (const el of vars) {
      if (el.hasAttribute("id")) {
        const folder = getFolderForVar(el.getAttribute("id"));
        if (folder === null) {
          notInFolder.push(el);
        } else {
          if (!(folder in folders)) folders[folder] = { vars: [], collapsed: false };
          if (data[folder]) folders[folder].collapsed = data[folder].collapsed;
          if (globalData[folder]) {
            folders[folder].collapsed = folders[folder].collapsed || globalData[folder].collapsed;
          }
          folders[folder].vars.push(el);
        }
      }
    }

    let newCat = [];
    let addedVars = false;
    for (const el of vars) {
      if (el.hasAttribute("id") || el.tagName === "LABEL") {
        if (!addedVars) {
          addedVars = true;
          for (const folder in folders) {
            newCat.push(makeButtonFor(folder));
            if (!folders[folder].collapsed) {
              for (const v of folders[folder].vars) {
                newCat.push(v);
                v.setAttribute("gap", SMALL_GAP);
                v.setAttribute("sa-in-folder", "");
                if (folders[folder].vars[0] === v) v.setAttribute("sa-first-in-folder", "");
              }
            }
          }
          newCat = newCat.concat(notInFolder);

          const sep = document.createElement("sep");
          sep.setAttribute("gap", BIG_GAP);
          newCat.push(sep);
        }
      } else {
        newCat.push(el);
      }
    }
    return newCat;
  };

  callbacks.varFolders = turnIntoFolders;
  await init(addon);

  addon.tab.createBlockContextMenu(
    (items, block) => {
      if (!addon || addon.self.disabled) return;
      if (block.getCategory() !== "data" && block.getCategory() !== "data-lists") return;

      const variable = block.workspace.getVariableById(block.getVars()[0]);
      if (variable) {
        const data = getFoldersData(!variable.isLocal);
        const alreadyInFolder = Object.values(data).find(
          (o) => o.variables && Array.isArray(o.variables) && o.variables.includes(variable.getId())
        );

        items.push({
          enabled: true,
          separator: true,
          text: alreadyInFolder ? "Move to other folder" : "Add to folder",
          callback: () => {
            const folder = prompt("Folder to add to:");
            if (folder === null) return;
            const data = getFoldersData(!variable.isLocal);
            for (const folder of Object.values(data)) {
              if (!folder) continue;
              if (folder.variables && Array.isArray(folder.variables)) {
                folder.variables = folder.variables.filter((id) => id !== variable.getId());
              }
            }
            if (!data[folder]) data[folder] = { variables: [], collapsed: true };
            data[folder].variables.push(variable.getId());
            setFoldersData(!variable.isLocal, data);
            block.workspace.refreshToolboxSelection_();
          },
        });
        if (alreadyInFolder) {
          items.push({
            enabled: true,
            separator: false,
            text: "Remove from folder",
            callback: () => {
              const data = getFoldersData(!variable.isLocal);
              for (const folder of Object.values(data)) {
                if (!folder) continue;
                if (folder.variables && Array.isArray(folder.variables)) {
                  folder.variables = folder.variables.filter((id) => id !== variable.getId());
                }
              }
              setFoldersData(!variable.isLocal, data);
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
        const folderName = xml.getAttribute("sa-folder-name") || "";
        this.callback_ = () => {
          const data = getFoldersData(false);
          const globalData = getFoldersData(true);
          if (data[folderName]) {
            this.saCollapsed = !data[folderName].collapsed;
            data[folderName].collapsed = !data[folderName].collapsed;
            setFoldersData(false, data);
          }
          if (globalData[folderName]) {
            this.saCollapsed = !globalData[folderName].collapsed;
            globalData[folderName].collapsed = !globalData[folderName].collapsed;
            setFoldersData(true, globalData);
          }
          targetWorkspace.refreshToolboxSelection_();
        };

        const data = getFoldersData(false);
        const globalData = getFoldersData(true);
        this.saCollapsed = false;
        if (data[folderName] && data[folderName].collapsed) this.saCollapsed = true;
        if (globalData[folderName] && globalData[folderName].collapsed) this.saCollapsed = true;
      }

      this.isLabel_ = isLabel;
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
  ScratchBlocks.VerticalFlyout.prototype.INDENT_WIDTH = 24;
  ScratchBlocks.VerticalFlyout.prototype.INDENT_START = ScratchBlocks.VerticalFlyout.prototype.ACTUAL_CHECKBOX_SIZE / 2;
  ScratchBlocks.VerticalFlyout.prototype.createCheckbox_ = function (block, cursorX, cursorY, blockHW) {
    const inFolder = !!block.saInFolder;
    const extraX = this.INDENT_WIDTH * +inFolder;

    this.CHECKBOX_SIZE = this.ACTUAL_CHECKBOX_SIZE;
    oldCreateCheckbox.call(this, block, cursorX + extraX, cursorY, blockHW);

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

    this.CHECKBOX_SIZE = this.ACTUAL_CHECKBOX_SIZE + extraX;
  };

  ScratchBlocks.getMainWorkspace().refreshToolboxSelection_();
  addon.self.addEventListener("disabled", () => ScratchBlocks.getMainWorkspace().refreshToolboxSelection_());
  addon.self.addEventListener("reenabled", () => ScratchBlocks.getMainWorkspace().refreshToolboxSelection_());
}
