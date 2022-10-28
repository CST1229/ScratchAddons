// Updates the paint editor; takes an undo snapshot and
// updates the costume on the stage.
// Basically all of the code here is copy-pasted from scratch-gui or scratch-paint.
export default function (redux, paper, vm) {
  const getLayer = function (layerString) {
    return paper.project.layers.find((layer) => layer.data && layer.data[layerString]);
  };

  const backgroundGuideLayer = getLayer("isBackgroundGuideLayer");
  const dragCrosshairLayer = getLayer("isDragCrosshairLayer");
  const outlineLayer = getLayer("isOutlineLayer");
  const guideLayer = getLayer("isGuideLayer");
  const rasterLayer = getLayer("isRasterLayer");
  outlineLayer.remove();
  guideLayer.remove();
  backgroundGuideLayer.remove();

  const getSelectedCostumeIndex = () => {
    const item = document.querySelector("[class*='selector_list-item'][class*='sprite-selector-item_is-selected']");
    if (!item) return -1;
    const numberEl = item.querySelector("[class*='sprite-selector-item_number']");
    if (!numberEl) return -1;
    return +numberEl.textContent - 1;
  };

  // the raster layer is the size of the artboard
  // and is present in vector
  const rasterLayer = getLayer("isRasterLayer");

  if (redux.state.scratchPaint.format.includes("VECTOR")) {
    const bounds = paper.project.activeLayer.drawnBounds;

    const centerX = bounds.width === 0 ? 0 : rasterLayer.bounds.width / 2 - bounds.x;
    const centerY = bounds.height === 0 ? 0 : rasterLayer.bounds.height / 2 - bounds.y;

    vm.updateSvg(
      getSelectedCostumeIndex(),
      paper.project.exportSVG({
        asString: true,
        bounds: "content",
        matrix: new paper.Matrix().scale(0.5).translate(-bounds.x, -bounds.y),
      }),
      centerX,
      centerY
    );
  } else {
    const currentRaster = rasterLayer?.children[0];
    if (!currentRaster) return;

    const getHitBounds = function (raster, rect) {
      const bounds = rect || raster.bounds;
      const width = bounds.width;
      const imageData = raster.getImageData(bounds);
      let top = 0;
      let bottom = imageData.height;
      let left = 0;
      let right = imageData.width;

      while (top < bottom && rowBlank_(imageData, width, top)) ++top;
      while (bottom - 1 > top && rowBlank_(imageData, width, bottom - 1)) --bottom;
      while (left < right && columnBlank_(imageData, width, left, top, bottom)) ++left;
      while (right - 1 > left && columnBlank_(imageData, width, right - 1, top, bottom)) --right;

      // Center an empty bitmap
      if (top === bottom) {
        top = bottom = imageData.height / 2;
      }
      if (left === right) {
        left = right = imageData.width / 2;
      }

      return new paper.Rectangle(left + bounds.left, top + bounds.top, right - left, bottom - top);
    };

    const rect = getHitBounds(currentRaster);

    if (rect.width === 0 || rect.height === 0) {
      rect.width = rect.height = 1;
    }

    const imageData = currentRaster.getImageData(rect);

    vm.updateBitmap(
      getSelectedCostumeIndex(),
      imageData(rasterLayer.bounds.width) - rect.x,
      rasterLayer.bounds.height - rect.y
    );
  }
  redux.dispatch({
    type: "scratch-paint/undo/SNAPSHOT",
    snapshot: {
      json: paper.project.exportJSON({ asString: false }),
      paintEditorFormat: redux.state.scratchPaint.format,
    },
  });

  if (!backgroundGuideLayer.index) {
    paper.project.addLayer(backgroundGuideLayer);
    backgroundGuideLayer.sendToBack();
  }
  if (!dragCrosshairLayer.index) {
    paper.project.addLayer(dragCrosshairLayer);
    dragCrosshairLayer.bringToFront();
  }
  if (!outlineLayer.index) {
    paper.project.addLayer(outlineLayer);
    outlineLayer.bringToFront();
  }
  if (!guideLayer.index) {
    paper.project.addLayer(guideLayer);
    guideLayer.bringToFront();
  }
}
