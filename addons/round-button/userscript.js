import updateCostume from "./snapshot.js";

export default async function ({ addon, msg, global, console }) {
	const paper = await addon.tab.traps.getPaper();
	
	function round(path, units = 10) {
		// Copy the array so that we don't iterate over added curves
		const curves = Array.from(path.curves);
		curves.forEach(c => {
			divideCurve(c, units);
		});
		curves.forEach(c => {
			roundCurve(c);
		});
	}
	window.roundSelected = function() {
		const selectedItems = addon.tab.redux.state.scratchPaint.selectedItems;
		for (const item of selectedItems) {
			if (item._class !== "Path") return;
			
			const selectedSegments = item.segments.filter(s => s.selected);
			const curvesToRound =
				selectedSegments.length > 0 ?
				Array.from(
					new Set(
						selectedSegments.map(s => s.curve)
					)
				) :
				Array.from(item.curves);
			
			const units = Math.min(...curvesToRound.map(c => c.length / 4 - 0.01));
			
			curvesToRound.forEach(c => {
				divideCurve(c, units);
			});
			curvesToRound.forEach(c => {
				roundCurve(c);
			});
			
			updateCostume(addon.tab.redux, paper, addon.tab.traps.vm);
		}
	}
	
	function divideCurve(c, units) {
		// Dividing more than the half-point creates wacky behavior,
		// so just make the shapes almost-circles
		const clampedUnits = Math.min(units, c.length / 2 - 0.01);
		if (c.previous) c.previous.divideAt(-clampedUnits);
		c.divideAt(clampedUnits);
	}
	function roundCurve(c) {
		// c.previous check to prevent deleting one segment on unclosed shapes
		if (c.previous) c.previous.segment1.smooth({type: "geometric", factor: 0.5});
		c.segment2.smooth({type: "geometric", factor: 0.5});
		// c.previous check to prevent errors on unclosed shapes
		if (c.previous) c.segment1.remove();
	}
	
	let roundButton;
	
	const updateButtonDisabled = () => {
		if (roundButton) {
			if (addon.tab.redux.state.scratchPaint.selectedItems.length > 0) {
				roundButton.removeAttribute("disabled");
				roundButton.classList.remove(
					addon.tab.scratchClass("button_mod-disabled")
				);
			} else {
				roundButton.setAttribute("disabled", "");
				roundButton.classList.add(
					addon.tab.scratchClass("button_mod-disabled")
				);
			}
		}
	}
	
	addon.tab.redux.initialize();
	addon.tab.redux.addEventListener("statechanged", (e) => {
		if (e.detail.action.type !== "scratch-paint/select/CHANGE_SELECTED_ITEMS") return;
		updateButtonDisabled();
	});
	
	while (true) {
		const modeButton = await addon.tab.waitForElement(
			'[class*="mode-tools_mod-dashed-border_"]:first-child > span:first-child',
			{
				markAsSeen: true,
				reduxCondition: (state) => {
					return !state.scratchGui?.mode.isPlayerOnly &&
						(
							state.scratchPaint?.mode === "RESHAPE" ||
							state.scratchPaint?.mode === "SELECT"
						);
				},
			}
		);
		
		roundButton = modeButton.cloneNode(true);
		addon.tab.displayNoneWhileDisabled(roundButton, {display: "inline-block"});
		updateButtonDisabled();
		roundButton.children[0].alt = "Round";
		roundButton.children[0].title = "Round";
		roundButton.children[1].textContent = "Round";
		
		roundButton.addEventListener("click", () => roundSelected());
		
		modeButton.parentElement.appendChild(roundButton);
	}
}