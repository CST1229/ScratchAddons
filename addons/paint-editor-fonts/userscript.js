export default async function ({ addon, msg, global, console }) {
	
	addon.tab.redux.initialize();
	window.pefAddon = addon;
	
	function createDropdownItem(label = "", font = null, onClick = null, closeMenu = true) {
		const itemRoot = document.createElement("span");
		itemRoot.classList.add(addon.tab.scratchClass("button_button"));
		itemRoot.classList.add(addon.tab.scratchClass("font-dropdown_mod-menu-item"));
		if (closeMenu) {
			itemRoot.addEventListener("click", closeFontDropdown);
		}
		if (typeof onClick === "string") {
			itemRoot.addEventListener("click", ()=>{setFont(font)});
		} else if (typeof onClick === "function") {
			itemRoot.addEventListener("click", onClick);
		}
		
		const itemInner = document.createElement("span");
		itemInner.textContent = label;
		if (font) {
			itemInner.style.fontFamily = font;
		}

		itemRoot.appendChild(itemInner);
		return itemRoot;
	}
	
	function createDivider() {
		const divider = document.createElement("span");
		divider.className = "sa-font-dropdown-divider";
		return divider;
	}
	
	function setFont(font) {
		addon.tab.redux.dispatch({
			type: "scratch-paint/fonts/CHANGE_FONT",
			font: font
		});
		addon.tab.redux.dispatch({
			type: "scratch-paint/text-tool/CHANGE_TEXT_EDIT_TARGET",
			textEditTargetId: null
		});
	}
	
	function closeFontDropdown() {
		const dropdownBtn = document.querySelector(
			"[class*='font-dropdown_font-dropdown'][class*='dropdown_dropdown_']"
		);
		if (!dropdownBtn) {
			console.error("Font dropdown button nonexistent");
			return;
		}
		dropdownBtn.click();
	}
	
	while (true) {
		const fontDropdown = await addon.tab.waitForElement(
			".Popover[class*='font-dropdown_font-dropdown'] [class*='font-dropdown_mod-context-menu']",
			{
				markAsSeen: true
			}
		);
		console.log(fontDropdown);
		
		const customItems = document.createElement("span");
		addon.tab.displayNoneWhileDisabled(customItems, {display: "block"});
		customItems.className = "sa-font-dropdown-custom-items";
		
		customItems.appendChild(createDivider());
		customItems.appendChild(createDropdownItem(
			"custom",
			null,
			() => {setFont(prompt("Enter a font name..."))},
			true
		));
		
		fontDropdown.appendChild(customItems);
	}
}