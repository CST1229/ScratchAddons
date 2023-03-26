import {initDCT} from "./module.js";

export default async function ({ addon, console, msg, safeMsg }) {
  initDCT(addon, msg, safeMsg);
}
