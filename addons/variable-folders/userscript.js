import {initVarFolders} from "../data-category-tweaks-v2/module.js";

export default async function ({ addon, msg, safeMsg, console }) {
  initVarFolders(addon, msg, safeMsg);
}
