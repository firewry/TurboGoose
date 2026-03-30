const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const editorContainer = document.getElementById('editor-container');
const propPanel = document.getElementById('properties-panel');
const propColorInput = document.getElementById('prop-blockColor');
const propColorPickerBtn = document.getElementById('prop-color-picker-btn');
const propColorRow = document.getElementById('prop-color-row');
const propFieldsContainer = document.getElementById('properties-fields');
const movementDetailsEl = document.getElementById('movement-details');
const movementFieldsContainer = document.getElementById('movement-fields');
const leftPanel = document.getElementById('left-panel');
const toggleLeftPanelBtn = document.getElementById('toggle-left-panel');
const leftPanelDivider = document.getElementById('left-panel-divider');
const leftPropertiesSection = document.getElementById('left-properties-section');
const leftLayersSection = document.getElementById('left-layers-section');
const layersListEl = document.getElementById('layers-list');
const layerAddBtn = document.getElementById('layer-add-btn');
const layerDeleteBtn = document.getElementById('layer-delete-btn');
const layerRenameBtn = document.getElementById('layer-rename-btn');
const layerDuplicateBtn = document.getElementById('layer-duplicate-btn');
const imageOverlayModal = document.getElementById('image-overlay-modal');
const imageOverlayDropzone = document.getElementById('image-overlay-dropzone');
const imageOverlayFileInput = document.getElementById('image-overlay-file-input');
const imageOverlayCancelBtn = document.getElementById('image-overlay-cancel-btn');
const objectCountDisplayEl = document.getElementById('object-count-display');
const objectCountValueEl = document.getElementById('object-count-value');
const layerContextMenuEl = document.getElementById('layer-context-menu');
const overlayConvertPanelEl = document.getElementById('overlay-convert-panel');
const overlayConvertResolutionEl = document.getElementById('overlay-convert-resolution');
const overlayConvertResolutionValueEl = document.getElementById('overlay-convert-resolution-value');
const overlayConvertCountEl = document.getElementById('overlay-convert-count');
const overlayConvertStatusEl = document.getElementById('overlay-convert-status');
const overlayConvertCancelBtn = document.getElementById('overlay-convert-cancel');
const overlayConvertApplyBtn = document.getElementById('overlay-convert-apply');

const FILL_TIMEOUT_MS = 120000;
const FILL_UI_UPDATE_INTERVAL_MS = 80;
const FILL_YIELD_EVERY_STEPS = 1800;
const FILL_PLACEMENT_CHUNK = 120;

let fillProgressOverlayEl = null;
let fillProgressBarEl = null;
let fillProgressTextEl = null;
let fillProgressMetaEl = null;
let isFillingLasso = false;
let lastObjectCountDisplay = { count: -1, tier: '' };

function getPlacedObjectCount() {
    return objects.reduce((count, obj) => count + (obj.type === 'finishLine' ? 0 : 1), 0);
}

function formatObjectCount(value) {
    if (value >= 1000) {
        const asK = Math.round((value / 1000) * 10) / 10;
        const trimmed = Number.isInteger(asK) ? String(asK) : asK.toFixed(1);
        return `${trimmed}k`;
    }
    return String(value);
}

function updateObjectCountDisplay() {
    if (!objectCountDisplayEl || !objectCountValueEl) return;

    const count = getPlacedObjectCount();
    let tier = '';
    if (count >= 2500) {
        tier = 'danger';
    } else if (count >= 2000) {
        tier = 'warn';
    }

    if (lastObjectCountDisplay.count === count && lastObjectCountDisplay.tier === tier) return;

    objectCountValueEl.textContent = formatObjectCount(count);
    objectCountDisplayEl.classList.toggle('warn', tier === 'warn');
    objectCountDisplayEl.classList.toggle('danger', tier === 'danger');
    lastObjectCountDisplay = { count, tier };
}

function ensureFillProgressOverlay() {
    if (fillProgressOverlayEl) return;

    fillProgressOverlayEl = document.createElement('div');
    fillProgressOverlayEl.style.position = 'fixed';
    fillProgressOverlayEl.style.left = '50%';
    fillProgressOverlayEl.style.top = '18px';
    fillProgressOverlayEl.style.transform = 'translateX(-50%)';
    fillProgressOverlayEl.style.zIndex = '99999';
    fillProgressOverlayEl.style.minWidth = '320px';
    fillProgressOverlayEl.style.maxWidth = '78vw';
    fillProgressOverlayEl.style.padding = '12px 14px';
    fillProgressOverlayEl.style.borderRadius = '10px';
    fillProgressOverlayEl.style.background = 'rgba(12, 18, 23, 0.88)';
    fillProgressOverlayEl.style.border = '1px solid rgba(115, 210, 255, 0.45)';
    fillProgressOverlayEl.style.boxShadow = '0 10px 28px rgba(0, 0, 0, 0.45)';
    fillProgressOverlayEl.style.backdropFilter = 'blur(6px)';
    fillProgressOverlayEl.style.display = 'none';
    fillProgressOverlayEl.style.pointerEvents = 'none';

    fillProgressTextEl = document.createElement('div');
    fillProgressTextEl.style.color = '#d8f7ff';
    fillProgressTextEl.style.fontFamily = 'Segoe UI, Arial, sans-serif';
    fillProgressTextEl.style.fontSize = '14px';
    fillProgressTextEl.style.fontWeight = '600';
    fillProgressTextEl.style.marginBottom = '7px';

    const track = document.createElement('div');
    track.style.width = '100%';
    track.style.height = '8px';
    track.style.borderRadius = '999px';
    track.style.background = 'rgba(255, 255, 255, 0.18)';
    track.style.overflow = 'hidden';

    fillProgressBarEl = document.createElement('div');
    fillProgressBarEl.style.height = '100%';
    fillProgressBarEl.style.width = '0%';
    fillProgressBarEl.style.background = 'linear-gradient(90deg, #5eead4, #38bdf8)';
    fillProgressBarEl.style.transition = 'width 80ms linear';
    track.appendChild(fillProgressBarEl);

    fillProgressMetaEl = document.createElement('div');
    fillProgressMetaEl.style.color = 'rgba(216, 247, 255, 0.86)';
    fillProgressMetaEl.style.fontFamily = 'Segoe UI, Arial, sans-serif';
    fillProgressMetaEl.style.fontSize = '12px';
    fillProgressMetaEl.style.marginTop = '7px';

    fillProgressOverlayEl.appendChild(fillProgressTextEl);
    fillProgressOverlayEl.appendChild(track);
    fillProgressOverlayEl.appendChild(fillProgressMetaEl);
    document.body.appendChild(fillProgressOverlayEl);
}

function showFillProgress(statusText, placedCount, estimatedTarget, elapsedMs) {
    ensureFillProgressOverlay();
    fillProgressOverlayEl.style.display = 'block';

    const total = Math.max(1, estimatedTarget || 1);
    const pct = Math.max(0, Math.min(100, (placedCount / total) * 100));
    fillProgressTextEl.textContent = `${statusText} - ${placedCount.toLocaleString()} blocks placed`;
    fillProgressBarEl.style.width = `${pct.toFixed(1)}%`;
    fillProgressMetaEl.textContent = `Estimated target: ${total.toLocaleString()} | Elapsed: ${(elapsedMs / 1000).toFixed(1)}s | Timeout: 120s`;
}

function hideFillProgress() {
    if (!fillProgressOverlayEl) return;
    fillProgressOverlayEl.style.display = 'none';
}

function yieldToUi() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

const toolPropertyOverrides = {};
let layerState = {
    nextId: 2,
    activeId: 1,
    items: [
        { id: 1, name: 'Layer 1', hidden: false, kind: 'objects' }
    ]
};
let draggingLayerId = null;
let objectClipboard = [];
const OVERLAY_MIN_SCALE = 0.05;
const OVERLAY_MAX_SCALE = 20;
const OVERLAY_ALPHA = 0.48;
const OVERLAY_CONVERT_MIN_RES = 12;
const OVERLAY_CONVERT_MAX_RES = 140;
const OVERLAY_CONVERT_TARGET_TOOL = 'colorBlock';
const OVERLAY_CONVERT_PROGRESS_CHUNK = 120;
const FAST_COLORABLE_RENDER_THRESHOLD = 2500;
const ADAPTIVE_FAST_COLORABLE_OBJECT_THRESHOLD = 700;
const ADAPTIVE_FAST_COLORABLE_FRAME_BUDGET_MS = 18;
const ADAPTIVE_FAST_COLORABLE_HOLD_MS = 220;
const FAST_COLORABLE_TYPES = new Set(['colorBlock', 'colorTile']);
const overlayImageCache = new Map();
const overlayImageDataCache = new Map();
let layerContextMenuLayerId = null;
let adaptiveFastColorableUntil = 0;
let sortedObjectsCache = [];
let sortedObjectsSnapshotRefs = [];
let sortedObjectsSnapshotZ = [];
const objectsByLayerScratch = new Map();

function getObjectZValue(obj) {
    return Number.isFinite(obj?.z) ? obj.z : 0;
}

function getSortedObjectsForDraw() {
    const len = objects.length;
    let mustResort = len !== sortedObjectsSnapshotRefs.length;

    if (!mustResort) {
        for (let i = 0; i < len; i++) {
            const obj = objects[i];
            const z = getObjectZValue(obj);
            if (sortedObjectsSnapshotRefs[i] !== obj || sortedObjectsSnapshotZ[i] !== z) {
                mustResort = true;
                break;
            }
        }
    }

    if (mustResort) {
        sortedObjectsCache = [...objects].sort((a, b) => getObjectZValue(a) - getObjectZValue(b));
        sortedObjectsSnapshotRefs = objects.slice();
        sortedObjectsSnapshotZ = new Array(len);
        for (let i = 0; i < len; i++) {
            sortedObjectsSnapshotZ[i] = getObjectZValue(sortedObjectsSnapshotRefs[i]);
        }
    }

    return sortedObjectsCache;
}

function buildObjectsByLayer(sortedObjects) {
    objectsByLayerScratch.forEach(list => {
        list.length = 0;
    });

    for (const obj of sortedObjects) {
        let layerBucket = objectsByLayerScratch.get(obj.layerId);
        if (!layerBucket) {
            layerBucket = [];
            objectsByLayerScratch.set(obj.layerId, layerBucket);
        }
        layerBucket.push(obj);
    }

    return objectsByLayerScratch;
}

const overlayConvertState = {
    isOpen: false,
    layerId: null,
    resolution: 52,
    estimatedCount: 0,
    previewBlocks: [],
    recomputeToken: 0,
    isConverting: false
};
// Cache of base z values per layer id, computed by updateObjectLayerDepths()
let layerBaseZCache = new Map();
const BASE_OBJECT_PROPERTY_DEFS = [
    { key: 'collison', label: 'Collison', type: 'checkbox', default: true },
    { key: 'zIndex', label: 'Z Index', type: 'number', default: 0, step: 1 }
];
const MOVEMENT_EXCLUDED_TYPES = new Set(['thwompPipe', 'thwomp']);
const MOVEMENT_PROPERTY_DEFS = [
    { key: 'eM', label: 'Enable Movement', type: 'checkbox', default: false, section: 'movement' },
    { key: 'mS', label: 'Move Speed', type: 'number', default: 5, step: 0.01, section: 'movement' },
    { key: 'mA', label: 'Move Angle (deg)', type: 'number', default: -Math.PI / 2, step: 1, section: 'movement' },
    { key: 'eMR', label: 'Enable Move Range', type: 'checkbox', default: false, section: 'movement' },
    { key: 'mR', label: 'Move Range', type: 'number', default: 300, step: 1, section: 'movement' },
    { key: 'rMR', label: 'Repeat Move Range', type: 'checkbox', default: false, section: 'movement' }
];
const MOVEMENT_PROPERTY_KEYS = new Set(MOVEMENT_PROPERTY_DEFS.map(def => def.key));

const OBJECT_PROPERTY_DEFS = {
    catBullet: [
        { key: 'sp', label: 'Bullet Speed', type: 'number', default: 4, step: 0.01 }
    ],
    thwomp: [
        { key: 'uS', label: 'Up Speed', type: 'number', default: 30, step: 0.01 },
        { key: 'dS', label: 'Down Speed', type: 'number', default: 200, step: 0.01 },
        { key: 'mR', label: 'Move Range', type: 'number', default: 75, step: 0.01 },
        { key: 'tD', label: 'Top Delay (ms)', type: 'number', default: 1000, step: 1 },
        { key: 'bD', label: 'Bottom Delay (ms)', type: 'number', default: 1000, step: 1 },
        { key: 'direction', label: 'Direction', type: 'select', default: 'up', options: ['up', 'down'] },
        { key: 'st', label: 'State', type: 'select', default: 'moving_down', options: ['moving_down', 'moving_up', 'waiting_top', 'waiting_bottom'] }
    ],
    thwompPipe: [
        { key: 'uS', label: 'Up Speed', type: 'number', default: 0, step: 0.01 },
        { key: 'dS', label: 'Down Speed', type: 'number', default: 0, step: 0.01 },
        { key: 'mR', label: 'Move Range', type: 'number', default: 75, step: 0.01 },
        { key: 'tD', label: 'Top Delay (ms)', type: 'number', default: 1000, step: 1 },
        { key: 'bD', label: 'Bottom Delay (ms)', type: 'number', default: 1000, step: 1 },
        { key: 'direction', label: 'Direction', type: 'select', default: 'up', options: ['up', 'down'] },
        { key: 'st', label: 'State', type: 'select', default: 'moving_down', options: ['moving_down', 'moving_up', 'waiting_top', 'waiting_bottom'] }
    ],
    tinyMushroom: [
        { key: 'sF', label: 'Scale Factor', type: 'number', default: 0.5, step: 0.01 }
    ],
    bigMushroom: [
        { key: 'gF', label: 'Growth Factor', type: 'number', default: 2, step: 0.01 }
    ],
    invincibilityStar: [
        { key: 'invincibilityDuration', label: 'Duration (s)', type: 'number', default: 5, step: 0.1 }
    ],
    invulnerabilityStar: [
        { key: 'invincibilityDuration', label: 'Duration (s)', type: 'number', default: 9.5, step: 0.1 }
    ],
    heavyWeight: [
        { key: 'wI', label: 'Weight Increase', type: 'number', default: 1.43, step: 0.01 }
    ],
    lightWeight: [
        { key: 'wD', label: 'Weight Decrease', type: 'number', default: 0.95, step: 0.01 }
    ],
    speedRing: [
        { key: 'sB', label: 'Speed Boost', type: 'number', default: 5, step: 0.01 },
        { key: 'sbD', label: 'Boost Duration (s)', type: 'number', default: 0.3, step: 0.01 }
    ],
    groundJuice: [
        { key: 'duration', label: 'Duration (s)', type: 'number', default: 30, step: 0.1 },
        { key: 'jumpForce', label: 'Jump Force', type: 'number', default: -8, step: 0.1 }
    ],
    bounceBlock: [
        { key: 'bF', label: 'Bounce Force', type: 'number', default: 10, step: 0.01 }
    ],
    bounceBlockA: [
        { key: 'bF', label: 'Bounce Force', type: 'number', default: 10, step: 0.01 }
    ],
    bounceBlockB: [
        { key: 'bF', label: 'Bounce Force', type: 'number', default: 10, step: 0.01 }
    ],
    bounceBlockD: [
        { key: 'bF', label: 'Bounce Force', type: 'number', default: 10, step: 0.01 }
    ]
};

function getObjectPropertyDefs(type) {
    if (!type || type === 'finishLine') return [];
    const baseDefs = [...BASE_OBJECT_PROPERTY_DEFS, ...(OBJECT_PROPERTY_DEFS[type] || [])];
    if (!MOVEMENT_EXCLUDED_TYPES.has(type)) {
        return [...baseDefs, ...MOVEMENT_PROPERTY_DEFS];
    }
    return baseDefs;
}

function objectSupportsMovement(type) {
    return !!type && type !== 'finishLine' && !MOVEMENT_EXCLUDED_TYPES.has(type);
}

function objectHasMovementEnabled(obj) {
    return objectSupportsMovement(obj.type) && obj.eM === true;
}

function degreesToMovementRadians(deg) {
    return ((Number(deg) || 0) - 90) * Math.PI / 180;
}

function movementRadiansToDegrees(rad) {
    return ((Number(rad) || 0) * 180 / Math.PI) + 90;
}

function getToolOverride(tool, key) {
    if (!toolPropertyOverrides[tool]) return undefined;
    return toolPropertyOverrides[tool][key];
}

function setToolOverride(tool, key, value) {
    if (!toolPropertyOverrides[tool]) toolPropertyOverrides[tool] = {};
    toolPropertyOverrides[tool][key] = value;
}

function getLayerById(id) {
    return layerState.items.find(layer => layer.id === id) || null;
}

function createDefaultObjectLayer(id, name) {
    return {
        id,
        name: name || `Layer ${id}`,
        hidden: false,
        kind: 'objects'
    };
}

function isOverlayLayer(layer) {
    return !!(layer && layer.kind === 'imageOverlay');
}

function normalizeLayerShape(layer) {
    if (!layer || typeof layer !== 'object') return null;
    if (isOverlayLayer(layer)) {
        const overlay = layer.overlay || {};
        return {
            id: layer.id,
            name: layer.name || `Overlay ${layer.id}`,
            hidden: !!layer.hidden,
            kind: 'imageOverlay',
            overlay: {
                src: typeof overlay.src === 'string' ? overlay.src : '',
                x: Number.isFinite(overlay.x) ? overlay.x : 0,
                y: Number.isFinite(overlay.y) ? overlay.y : 0,
                scale: Number.isFinite(overlay.scale) ? overlay.scale : 1,
                rotation: Number.isFinite(overlay.rotation) ? overlay.rotation : 0
            }
        };
    }
    return {
        id: layer.id,
        name: layer.name || `Layer ${layer.id}`,
        hidden: !!layer.hidden,
        kind: 'objects'
    };
}

function isActiveLayerObjectLocked() {
    return isOverlayLayer(getActiveLayer());
}

function getOverlayImageForLayer(layer) {
    if (!isOverlayLayer(layer) || !layer.overlay || !layer.overlay.src) return null;
    const src = layer.overlay.src;
    if (overlayImageCache.has(src)) {
        return overlayImageCache.get(src);
    }
    const img = new Image();
    img.onload = () => draw();
    img.onerror = () => draw();
    img.src = src;
    overlayImageCache.set(src, img);
    return img;
}

function getOverlayImageDataForLayer(layer) {
    if (!isOverlayLayer(layer) || !layer.overlay || !layer.overlay.src) return null;
    const src = layer.overlay.src;
    if (overlayImageDataCache.has(src)) {
        return overlayImageDataCache.get(src);
    }

    const img = getOverlayImageForLayer(layer);
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return null;

    try {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = img.naturalWidth;
        offCanvas.height = img.naturalHeight;
        const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(img, 0, 0);
        const imageData = offCtx.getImageData(0, 0, offCanvas.width, offCanvas.height);
        const out = {
            width: offCanvas.width,
            height: offCanvas.height,
            data: imageData.data
        };
        overlayImageDataCache.set(src, out);
        return out;
    } catch (err) {
        return null;
    }
}

function getActiveOverlayData() {
    const active = getActiveLayer();
    if (!isOverlayLayer(active) || !active.overlay || !active.overlay.src) return null;
    return active.overlay;
}

function hideLayerContextMenu() {
    if (!layerContextMenuEl) return;
    layerContextMenuEl.classList.add('hidden');
    layerContextMenuLayerId = null;
}

function showLayerContextMenuForLayer(layerId, clientX, clientY) {
    if (!layerContextMenuEl) return;
    const layer = getLayerById(layerId);
    if (!layer) return;

    layerContextMenuLayerId = layerId;
    layerContextMenuEl.classList.remove('hidden');

    const convertBtn = layerContextMenuEl.querySelector('button[data-action="convert"]');
    if (convertBtn) {
        convertBtn.style.display = isOverlayLayer(layer) ? '' : 'none';
    }

    const menuRect = layerContextMenuEl.getBoundingClientRect();
    const pad = 8;
    const maxX = window.innerWidth - menuRect.width - pad;
    const maxY = window.innerHeight - menuRect.height - pad;
    layerContextMenuEl.style.left = `${Math.max(pad, Math.min(clientX, maxX))}px`;
    layerContextMenuEl.style.top = `${Math.max(pad, Math.min(clientY, maxY))}px`;
}

function getConvertScaleFromResolution(resolution) {
    const normalized = clamp((resolution - OVERLAY_CONVERT_MIN_RES) / (OVERLAY_CONVERT_MAX_RES - OVERLAY_CONVERT_MIN_RES), 0, 1);
    return Number((1.35 - (normalized * 1.15)).toFixed(3));
}

function sampleOverlayToBlockList(layer, resolution, maxCount = 35000) {
    if (!isOverlayLayer(layer) || !layer.overlay) return [];
    const overlay = layer.overlay;
    const imageData = getOverlayImageDataForLayer(layer);
    if (!imageData) return [];
    if (!objectConfigs[OVERLAY_CONVERT_TARGET_TOOL]) return [];

    const dims = getToolDimensions(OVERLAY_CONVERT_TARGET_TOOL);
    const scale = getConvertScaleFromResolution(resolution);
    const stepX = Math.max(1, dims.w * scale);
    const stepY = Math.max(1, dims.h * scale);

    const drawW = imageData.width * Math.max(OVERLAY_MIN_SCALE, Number(overlay.scale) || 1);
    const drawH = imageData.height * Math.max(OVERLAY_MIN_SCALE, Number(overlay.scale) || 1);
    const cols = Math.max(1, Math.floor(drawW / stepX));
    const rows = Math.max(1, Math.floor(drawH / stepY));
    const rot = (Number(overlay.rotation) || 0) * Math.PI / 180;
    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    const blocks = [];
    for (let row = 0; row < rows; row++) {
        const localY = (-drawH / 2) + ((row + 0.5) * stepY);
        const srcY = Math.max(0, Math.min(imageData.height - 1, Math.floor(((localY + drawH / 2) / drawH) * imageData.height)));

        for (let col = 0; col < cols; col++) {
            if (blocks.length >= maxCount) return blocks;

            const localX = (-drawW / 2) + ((col + 0.5) * stepX);
            const srcX = Math.max(0, Math.min(imageData.width - 1, Math.floor(((localX + drawW / 2) / drawW) * imageData.width)));
            const pxIndex = ((srcY * imageData.width) + srcX) * 4;
            const alpha = imageData.data[pxIndex + 3];
            if (alpha < 52) continue;

            const worldX = (overlay.x || 0) + (localX * cos - localY * sin);
            const worldY = (overlay.y || 0) + (localX * sin + localY * cos);
            blocks.push({
                x: Number(worldX.toFixed(2)),
                y: Number(worldY.toFixed(2)),
                color: rgbToHex(imageData.data[pxIndex], imageData.data[pxIndex + 1], imageData.data[pxIndex + 2]),
                scale
            });
        }
    }

    return blocks;
}

function updateOverlayConvertMeta() {
    if (!overlayConvertCountEl || !overlayConvertResolutionValueEl) return;
    overlayConvertResolutionValueEl.textContent = String(overlayConvertState.resolution);
    overlayConvertCountEl.textContent = `Estimated blocks: ${overlayConvertState.estimatedCount.toLocaleString()}`;
}

function setOverlayConvertStatus(text) {
    if (!overlayConvertStatusEl) return;
    overlayConvertStatusEl.textContent = text || '';
}

function scheduleOverlayConvertPreview() {
    if (!overlayConvertState.isOpen || overlayConvertState.layerId === null) return;

    const token = ++overlayConvertState.recomputeToken;
    setOverlayConvertStatus('Previewing...');

    requestAnimationFrame(() => {
        if (token !== overlayConvertState.recomputeToken) return;
        const layer = getLayerById(overlayConvertState.layerId);
        if (!layer || !isOverlayLayer(layer)) {
            closeOverlayConvertPanel();
            return;
        }

        const blocks = sampleOverlayToBlockList(layer, overlayConvertState.resolution, 16000);
        overlayConvertState.previewBlocks = blocks;
        overlayConvertState.estimatedCount = blocks.length;
        updateOverlayConvertMeta();
        setOverlayConvertStatus(blocks.length >= 16000 ? 'Preview capped for performance' : 'Live preview');
        draw();
    });
}

function closeOverlayConvertPanel() {
    overlayConvertState.isOpen = false;
    overlayConvertState.layerId = null;
    overlayConvertState.previewBlocks = [];
    overlayConvertState.estimatedCount = 0;
    overlayConvertState.recomputeToken++;
    if (overlayConvertPanelEl) overlayConvertPanelEl.classList.add('hidden');
    setOverlayConvertStatus('');
    draw();
}

function openOverlayConvertPanel(layerId) {
    const layer = getLayerById(layerId);
    if (!layer || !isOverlayLayer(layer)) return;

    layerState.activeId = layer.id;
    sanitizeSelectionForActiveLayer();
    renderLayersUI();

    overlayConvertState.isOpen = true;
    overlayConvertState.layerId = layer.id;
    overlayConvertState.resolution = clamp(Number(overlayConvertResolutionEl ? overlayConvertResolutionEl.value : 52), OVERLAY_CONVERT_MIN_RES, OVERLAY_CONVERT_MAX_RES);
    overlayConvertState.previewBlocks = [];
    overlayConvertState.estimatedCount = 0;
    if (overlayConvertPanelEl) overlayConvertPanelEl.classList.remove('hidden');
    updateOverlayConvertMeta();
    scheduleOverlayConvertPreview();
}

async function convertOverlayLayerToBlocks(layerId) {
    const sourceLayer = getLayerById(layerId);
    if (!sourceLayer || !isOverlayLayer(sourceLayer)) return;
    if (!objectConfigs[OVERLAY_CONVERT_TARGET_TOOL]) {
        alert('Color Block tool config is missing, so conversion cannot run.');
        return;
    }
    if (overlayConvertState.isConverting) return;

    const fullBlocks = sampleOverlayToBlockList(sourceLayer, overlayConvertState.resolution, 34000);
    if (fullBlocks.length === 0) {
        alert('No visible pixels were found to convert.');
        return;
    }

    overlayConvertState.isConverting = true;
    closeOverlayConvertPanel();

    beginUndoBatch();
    const startedAt = performance.now();
    let lastUiUpdate = startedAt;

    const sourceIndex = getLayerIndexById(sourceLayer.id);
    const targetLayerId = layerState.nextId++;
    const targetLayer = createDefaultObjectLayer(targetLayerId, `${sourceLayer.name} Blocks`);
    const insertIndex = sourceIndex >= 0 ? sourceIndex + 1 : layerState.items.length;
    layerState.items.splice(insertIndex, 0, targetLayer);
    layerState.activeId = targetLayerId;
    renderLayersUI();

    const total = fullBlocks.length;
    showFillProgress('Converting Image', 0, total, 0);

    for (let i = 0; i < total; i++) {
        const block = fullBlocks[i];
        const placed = createPlacedObject(OVERLAY_CONVERT_TARGET_TOOL, block.x, block.y, 0, block.scale);
        placed.color = block.color;
        objects.push(placed);
        markUndoDirty();

        if ((i + 1) % OVERLAY_CONVERT_PROGRESS_CHUNK === 0 || i === total - 1) {
            const now = performance.now();
            if ((now - lastUiUpdate) >= FILL_UI_UPDATE_INTERVAL_MS || i === total - 1) {
                showFillProgress('Converting Image', i + 1, total, now - startedAt);
                draw();
                await yieldToUi();
                lastUiUpdate = now;
            }
        }
    }

    hideFillProgress();
    endUndoBatch();
    updateObjectLayerDepths();
    renderLayersUI();
    draw();
    overlayConvertState.isConverting = false;
}

function handleLayerContextAction(action, layerId) {
    const layer = getLayerById(layerId);
    if (!layer) return;

    layerState.activeId = layer.id;
    sanitizeSelectionForActiveLayer();
    renderLayersUI();

    if (action === 'duplicate') {
        duplicateActiveLayer();
        return;
    }
    if (action === 'rename') {
        renameActiveLayer();
        return;
    }
    if (action === 'delete') {
        deleteActiveLayer();
        return;
    }
    if (action === 'convert' && isOverlayLayer(layer)) {
        openOverlayConvertPanel(layer.id);
    }
}

function getLayerIndexById(id) {
    return layerState.items.findIndex(layer => layer.id === id);
}

function getBottomLayer() {
    if (layerState.items.length === 0) return null;
    return layerState.items[layerState.items.length - 1];
}

function getLayerZById(layerId) {
    const index = getLayerIndexById(layerId);
    if (index < 0) return 5;
    return (layerState.items.length - index) * 5;
}

function assignLayerToObject(obj, layerId) {
    const fallback = getBottomLayer();
    const resolvedId = getLayerById(layerId) ? layerId : (fallback ? fallback.id : 1);
    obj.layerId = resolvedId;
    // Use cached base z if available, otherwise fall back to old formula
    const baseZ = layerBaseZCache.has(resolvedId) ? layerBaseZCache.get(resolvedId) : getLayerZById(resolvedId);
    const zIndexProp = Number(obj.zIndex) || 0;
    obj.z = baseZ + zIndexProp;
}

function updateObjectLayerDepths() {
    const n = layerState.items.length;
    layerBaseZCache.clear();

    if (n === 0) return;

    // Process layers from bottom to top.
    // layerState.items[n-1] = bottom layer, layerState.items[0] = top layer.
    // Bottom layer base = 5 (prevLayerMaxZ starts at 4, so 4+1=5).
    let prevLayerMaxZ = 4;

    for (let i = n - 1; i >= 0; i--) {
        const layer = layerState.items[i];
        const baseZ = prevLayerMaxZ + 1;
        layerBaseZCache.set(layer.id, baseZ);

        // Find the max z value for objects in this layer to set the base for the layer above.
        let maxZ = baseZ; // minimum (if no objects or all have zIndex=0)
        for (const obj of objects) {
            if (!obj || obj.type === 'finishLine') continue;
            if (obj.layerId !== layer.id) continue;
            const zIndexProp = Number(obj.zIndex) || 0;
            const objZ = baseZ + zIndexProp;
            if (objZ > maxZ) maxZ = objZ;
        }

        prevLayerMaxZ = maxZ;
    }

    // Second pass: update all object z values using the computed base z per layer.
    for (const obj of objects) {
        if (!obj || obj.type === 'finishLine') continue;
        const baseZ = layerBaseZCache.has(obj.layerId) ? layerBaseZCache.get(obj.layerId) : getLayerZById(obj.layerId);
        const zIndexProp = Number(obj.zIndex) || 0;
        obj.z = baseZ + zIndexProp;
    }
}

function normalizeLayerStateForObjects() {
    layerState.items = layerState.items
        .map(layer => normalizeLayerShape(layer))
        .filter(Boolean);

    const objectList = objects.filter(obj => obj && obj.type !== 'finishLine');
    const hasLayerIds = objectList.some(obj => getLayerById(obj.layerId));

    if (!hasLayerIds) {
        const zIndices = objectList
            .map(obj => Math.round(((Number(obj.z) || 5) - 5) / 5))
            .filter(idx => Number.isFinite(idx))
            .map(idx => Math.max(0, idx));

        const maxIndex = zIndices.length > 0 ? Math.max(...zIndices) : 0;
        const neededLayers = Math.max(1, maxIndex + 1);

        layerState.items = [];
        for (let i = 0; i < neededLayers; i++) {
            const id = i + 1;
            layerState.items.push(createDefaultObjectLayer(id));
        }
        layerState.nextId = neededLayers + 1;
        layerState.activeId = layerState.items[0].id;

        for (const obj of objectList) {
            const zIndex = Math.max(0, Math.round(((Number(obj.z) || 5) - 5) / 5));
            const targetIndex = Math.max(0, Math.min(layerState.items.length - 1, layerState.items.length - 1 - zIndex));
            assignLayerToObject(obj, layerState.items[targetIndex].id);
        }
        // Recompute all z values now that layers are established.
        updateObjectLayerDepths();
    } else {
        ensureActiveLayerIsValid();
        updateObjectLayerDepths();
    }
}

function isLayerHiddenForObject(obj) {
    const layer = getLayerById(obj.layerId);
    return !!(layer && layer.hidden);
}

function isObjectEditableInCurrentLayer(obj) {
    if (!obj || obj.type === 'finishLine') return true;
    const active = getActiveLayer();
    if (!active) return true;
    if (isOverlayLayer(active)) return false;
    const layer = getLayerById(obj.layerId);
    if (layer && layer.hidden) return false;
    return obj.layerId === active.id;
}

function sanitizeSelectionForActiveLayer() {
    if (isActiveLayerObjectLocked()) {
        selectedObjects = [];
        return;
    }
    selectedObjects = selectedObjects.filter(obj => obj.type === 'finishLine' || isObjectEditableInCurrentLayer(obj));
}

function getActiveLayer() {
    return getLayerById(layerState.activeId) || layerState.items[0] || null;
}

function ensureActiveLayerIsValid() {
    if (!getLayerById(layerState.activeId) && layerState.items.length > 0) {
        layerState.activeId = layerState.items[0].id;
    }
}

function moveLayer(fromId, toId, placeAfter) {
    if (fromId === toId) return;

    const fromIndex = layerState.items.findIndex(layer => layer.id === fromId);
    const toIndex = layerState.items.findIndex(layer => layer.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;

    const [moved] = layerState.items.splice(fromIndex, 1);
    const adjustedTo = layerState.items.findIndex(layer => layer.id === toId);
    const insertIndex = placeAfter ? adjustedTo + 1 : adjustedTo;
    layerState.items.splice(insertIndex, 0, moved);
    updateObjectLayerDepths();
}

function commitInlineLayerRename(layerId, inputEl) {
    const layer = getLayerById(layerId);
    if (!layer || !inputEl) return;

    const trimmed = inputEl.value.trim();
    runUndoableAction(() => {
        if (trimmed) {
            layer.name = trimmed;
        }
        renderLayersUI();
        draw();
    });
}

function startInlineLayerRename(layerId) {
    const row = layersListEl ? layersListEl.querySelector(`.layer-row[data-layer-id="${layerId}"]`) : null;
    if (!row) return;

    const layer = getLayerById(layerId);
    if (!layer) return;

    const nameEl = row.querySelector('.layer-name');
    if (!nameEl) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'layer-name-input';
    input.value = layer.name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let committed = false;
    const commitOnce = () => {
        if (committed) return;
        committed = true;
        commitInlineLayerRename(layerId, input);
    };

    input.addEventListener('blur', commitOnce);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitOnce();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            committed = true;
            renderLayersUI();
        }
    });
}

function renderLayersUI() {
    if (!layersListEl) return;

    layersListEl.innerHTML = '';
    for (const layer of layerState.items) {
        const row = document.createElement('div');
        row.className = `layer-row${layer.id === layerState.activeId ? ' active' : ''}`;
        row.dataset.layerId = String(layer.id);
        row.draggable = true;

        const mainEl = document.createElement('div');
        mainEl.className = 'layer-main';

        if (isOverlayLayer(layer)) {
            const badge = document.createElement('span');
            badge.className = 'layer-overlay-badge';
            badge.title = 'Image Overlay Layer';
            badge.innerHTML = '<i class="fa-regular fa-image" aria-hidden="true"></i>';
            mainEl.appendChild(badge);
        }

        const nameEl = document.createElement('span');
        nameEl.className = 'layer-name';
        nameEl.textContent = layer.name;
        nameEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            startInlineLayerRename(layer.id);
        });
        mainEl.appendChild(nameEl);

        const hideBtn = document.createElement('button');
        hideBtn.className = 'layer-hide-btn';
        hideBtn.title = layer.hidden ? 'Show Layer' : 'Hide Layer';
        hideBtn.innerHTML = layer.hidden
            ? '<i class="fa-regular fa-eye-slash" aria-hidden="true"></i>'
            : '<i class="fa-regular fa-eye" aria-hidden="true"></i>';
        hideBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            runUndoableAction(() => {
                layer.hidden = !layer.hidden;
                sanitizeSelectionForActiveLayer();
                renderLayersUI();
                draw();
            });
        });

        row.addEventListener('click', () => {
            layerState.activeId = layer.id;
            sanitizeSelectionForActiveLayer();
            if (isOverlayLayer(layer)) {
                currentTool = 'none';
                updateToolbarActiveTool();
            }
            renderLayersUI();
            draw();
        });

        row.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showLayerContextMenuForLayer(layer.id, e.clientX, e.clientY);
        });

        row.addEventListener('dragstart', (e) => {
            draggingLayerId = layer.id;
            row.classList.add('dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(layer.id));
            }
        });

        row.addEventListener('dragend', () => {
            draggingLayerId = null;
            const rows = layersListEl.querySelectorAll('.layer-row');
            rows.forEach(item => item.classList.remove('dragging', 'drop-before', 'drop-after'));
        });

        row.addEventListener('dragover', (e) => {
            if (draggingLayerId === null || draggingLayerId === layer.id) return;
            e.preventDefault();
            const rect = row.getBoundingClientRect();
            const placeAfter = (e.clientY - rect.top) > rect.height / 2;
            row.classList.toggle('drop-before', !placeAfter);
            row.classList.toggle('drop-after', placeAfter);
        });

        row.addEventListener('dragleave', () => {
            row.classList.remove('drop-before', 'drop-after');
        });

        row.addEventListener('drop', (e) => {
            if (draggingLayerId === null || draggingLayerId === layer.id) return;
            e.preventDefault();
            const rect = row.getBoundingClientRect();
            const placeAfter = (e.clientY - rect.top) > rect.height / 2;
            runUndoableAction(() => {
                moveLayer(draggingLayerId, layer.id, placeAfter);
                layerState.activeId = draggingLayerId;
                renderLayersUI();
                draw();
            });
        });

        row.appendChild(mainEl);
        row.appendChild(hideBtn);
        layersListEl.appendChild(row);
    }
}

function createLayer() {
    runUndoableAction(() => {
        const id = layerState.nextId++;
        const layer = createDefaultObjectLayer(id);
        const activeIndex = layerState.items.findIndex(item => item.id === layerState.activeId);
        const insertIndex = activeIndex >= 0 ? activeIndex : layerState.items.length;
        layerState.items.splice(insertIndex, 0, layer);
        layerState.activeId = id;
        updateObjectLayerDepths();
        renderLayersUI();
        draw();
    });
}

function deleteActiveLayer() {
    if (layerState.items.length <= 1) {
        alert('At least one layer is required.');
        return;
    }
    runUndoableAction(() => {
        const removedId = layerState.activeId;
        layerState.items = layerState.items.filter(layer => layer.id !== removedId);

        objects = objects.filter(obj => obj.type === 'finishLine' || obj.layerId !== removedId);

        ensureActiveLayerIsValid();
        sanitizeSelectionForActiveLayer();
        updateObjectLayerDepths();
        renderLayersUI();
        draw();
    });
}

function duplicateActiveLayer() {
    const active = getActiveLayer();
    if (!active) return;

    runUndoableAction(() => {
        const sourceLayerId = active.id;
        const id = layerState.nextId++;
        const copy = normalizeLayerShape({
            ...deepClone(active),
            id,
            name: `${active.name} Copy`
        });

        const activeIndex = layerState.items.findIndex(layer => layer.id === active.id);
        const insertIndex = activeIndex >= 0 ? activeIndex : layerState.items.length;
        layerState.items.splice(insertIndex, 0, copy);

        if (!isOverlayLayer(active)) {
            // Duplicate all objects from the source layer into the new copied layer.
            const duplicatedObjects = objects
                .filter(obj => obj.type !== 'finishLine' && obj.layerId === sourceLayerId)
                .map(obj => {
                    const clone = deepClone(obj);
                    assignLayerToObject(clone, id);
                    return clone;
                });
            if (duplicatedObjects.length > 0) {
                objects.push(...duplicatedObjects);
            }
        }

        layerState.activeId = id;
        updateObjectLayerDepths();
        renderLayersUI();
        draw();
    });
}

function renameActiveLayer() {
    const active = getActiveLayer();
    if (!active) return;
    startInlineLayerRename(active.id);
}

function setupLeftPanelResize() {
    if (!leftPanelDivider || !leftPanel || !leftPropertiesSection || !leftLayersSection) return;

    let isDragging = false;

    const onMove = (e) => {
        if (!isDragging) return;
        const bounds = leftPanel.getBoundingClientRect();
        const localY = e.clientY - bounds.top;
        const pct = Math.max(20, Math.min(80, (localY / bounds.height) * 100));
        leftPropertiesSection.style.flex = `0 0 ${pct}%`;
        leftLayersSection.style.flex = `1 1 ${100 - pct}%`;
    };

    const onUp = () => {
        isDragging = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
    };

    leftPanelDivider.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isDragging = true;
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'row-resize';
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });
}

function setupLayersUI() {
    if (layerAddBtn) layerAddBtn.addEventListener('click', createLayer);
    if (layerDeleteBtn) layerDeleteBtn.addEventListener('click', deleteActiveLayer);
    if (layerRenameBtn) layerRenameBtn.addEventListener('click', renameActiveLayer);
    if (layerDuplicateBtn) layerDuplicateBtn.addEventListener('click', duplicateActiveLayer);

    if (layerContextMenuEl) {
        layerContextMenuEl.addEventListener('click', (e) => {
            const target = e.target instanceof HTMLElement ? e.target.closest('button[data-action]') : null;
            if (!target) return;
            const action = target.dataset.action;
            if (!action || layerContextMenuLayerId === null) return;
            const actionLayerId = layerContextMenuLayerId;
            hideLayerContextMenu();
            handleLayerContextAction(action, actionLayerId);
        });

        document.addEventListener('click', (e) => {
            if (layerContextMenuEl.classList.contains('hidden')) return;
            if (e.target instanceof Node && layerContextMenuEl.contains(e.target)) return;
            hideLayerContextMenu();
        });

        window.addEventListener('resize', hideLayerContextMenu);
        window.addEventListener('scroll', hideLayerContextMenu, true);
    }

    if (overlayConvertResolutionEl) {
        overlayConvertResolutionEl.min = String(OVERLAY_CONVERT_MIN_RES);
        overlayConvertResolutionEl.max = String(OVERLAY_CONVERT_MAX_RES);
        overlayConvertResolutionEl.addEventListener('input', () => {
            overlayConvertState.resolution = clamp(Number(overlayConvertResolutionEl.value), OVERLAY_CONVERT_MIN_RES, OVERLAY_CONVERT_MAX_RES);
            updateOverlayConvertMeta();
            scheduleOverlayConvertPreview();
        });
    }

    if (overlayConvertCancelBtn) {
        overlayConvertCancelBtn.addEventListener('click', () => {
            if (overlayConvertState.isConverting) return;
            closeOverlayConvertPanel();
        });
    }

    if (overlayConvertApplyBtn) {
        overlayConvertApplyBtn.addEventListener('click', () => {
            if (!overlayConvertState.isOpen || overlayConvertState.layerId === null) return;
            convertOverlayLayerToBlocks(overlayConvertState.layerId)
                .catch((err) => {
                    console.error('Overlay convert failed:', err);
                    hideFillProgress();
                    overlayConvertState.isConverting = false;
                    endUndoBatch();
                    alert('Image conversion failed due to an internal error.');
                });
        });
    }

    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        hideLayerContextMenu();
        if (overlayConvertState.isOpen && !overlayConvertState.isConverting) {
            closeOverlayConvertPanel();
        }
    });

    renderLayersUI();
}

function getViewportCenterWorld() {
    return {
        x: (-camera.x + width / 2) / camera.zoom,
        y: (-camera.y + height / 2) / camera.zoom
    };
}

function closeImageOverlayModal() {
    if (!imageOverlayModal) return;
    imageOverlayModal.classList.add('hidden');
    if (imageOverlayDropzone) imageOverlayDropzone.classList.remove('drag-over');
    if (imageOverlayFileInput) imageOverlayFileInput.value = '';
}

function openImageOverlayModal() {
    if (!imageOverlayModal) return;
    imageOverlayModal.classList.remove('hidden');
    if (imageOverlayDropzone) imageOverlayDropzone.focus();
}

function createImageOverlayLayerFromDataUrl(dataUrl) {
    if (!dataUrl) return;

    runUndoableAction(() => {
        const id = layerState.nextId++;
        const center = getViewportCenterWorld();
        const layer = {
            id,
            name: `Overlay ${id}`,
            hidden: false,
            kind: 'imageOverlay',
            overlay: {
                src: dataUrl,
                x: Number(center.x.toFixed(2)),
                y: Number(center.y.toFixed(2)),
                scale: 1,
                rotation: 0
            }
        };

        overlayImageDataCache.delete(dataUrl);

        const activeIndex = layerState.items.findIndex(item => item.id === layerState.activeId);
        const insertIndex = activeIndex >= 0 ? activeIndex : layerState.items.length;
        layerState.items.splice(insertIndex, 0, layer);
        layerState.activeId = id;
        selectedObjects = [];
        currentTool = 'none';
        updateToolbarActiveTool();
        renderLayersUI();
        draw();
    });
}

function processOverlayImageFile(file) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
        alert('Please provide an image file.');
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) return;
        closeImageOverlayModal();
        createImageOverlayLayerFromDataUrl(result);
    };
    reader.onerror = () => {
        alert('Failed to read image file.');
    };
    reader.readAsDataURL(file);
}

function setupImageOverlayModal() {
    if (!imageOverlayModal || !imageOverlayDropzone || !imageOverlayFileInput) return;

    imageOverlayDropzone.addEventListener('click', () => imageOverlayFileInput.click());
    imageOverlayDropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            imageOverlayFileInput.click();
        }
    });

    imageOverlayFileInput.addEventListener('change', () => {
        const file = imageOverlayFileInput.files && imageOverlayFileInput.files[0];
        processOverlayImageFile(file);
    });

    imageOverlayDropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        imageOverlayDropzone.classList.add('drag-over');
    });

    imageOverlayDropzone.addEventListener('dragleave', () => {
        imageOverlayDropzone.classList.remove('drag-over');
    });

    imageOverlayDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        imageOverlayDropzone.classList.remove('drag-over');
        const file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        processOverlayImageFile(file);
    });

    window.addEventListener('paste', (e) => {
        if (imageOverlayModal.classList.contains('hidden')) return;
        const items = e.clipboardData ? Array.from(e.clipboardData.items || []) : [];
        const imageItem = items.find(item => item.type && item.type.startsWith('image/'));
        if (!imageItem) return;
        e.preventDefault();
        const file = imageItem.getAsFile();
        processOverlayImageFile(file);
    });

    if (imageOverlayCancelBtn) {
        imageOverlayCancelBtn.addEventListener('click', () => {
            closeImageOverlayModal();
        });
    }

    imageOverlayModal.addEventListener('click', (e) => {
        if (e.target === imageOverlayModal) {
            closeImageOverlayModal();
        }
    });
}

function setupLeftPanelToggle() {
    if (!toggleLeftPanelBtn || !leftPanel) return;

    toggleLeftPanelBtn.addEventListener('click', () => {
        leftPanel.classList.toggle('closed');
        toggleLeftPanelBtn.textContent = leftPanel.classList.contains('closed') ? '▶' : '◀';
    });
}

function getSignedScaleFromCollison(scale, collisonEnabled) {
    const magnitude = Math.max(0.005, Math.abs(scale || 1));
    return collisonEnabled ? magnitude : -magnitude;
}

function createPlacedObject(type, x, y, rotation, scale) {
    const placed = {
        type,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        rotation,
        s: scale,
        color: (objectConfigs[type] && objectConfigs[type].colorable) ? levelConfig.lastUsedColor : undefined
    };

    const defs = getObjectPropertyDefs(type);
    for (const def of defs) {
        const override = getToolOverride(type, def.key);
        placed[def.key] = override !== undefined ? override : def.default;
    }

    const activeLayer = getActiveLayer();
    assignLayerToObject(placed, activeLayer ? activeLayer.id : 1);

    placed.s = getSignedScaleFromCollison(placed.s, placed.collison !== false);

    return placed;
}

// Camera and scaling
let camera = { x: 175, y: 0, zoom: 1.5 };
let isPanning = false;
let startPan = { x: 0, y: 0 };

// Game constants derived from true game units
const SPIKE_WIDTH = 75.92;
let SPIKE_HEIGHT = 48;

const GOOSE_WIDTH = 45;
const GOOSE_HEIGHT = 45;

// Helper to safely tint images without destroying main canvas
const _tintCanvas = document.createElement('canvas');
const _tintCtx = _tintCanvas.getContext('2d');
const tintedSpriteCache = new Map();
const MAX_TINT_CACHE_ENTRIES = 2200;

function getTintCacheKey(img, color, width, height) {
    const normalizedColor = String(color || '#ffffff').trim().toLowerCase();
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    return `${img.src}|${normalizedColor}|${w}x${h}`;
}

function getTintedSprite(img, color, width, height) {
    const normalizedColor = String(color || '#ffffff').trim().toLowerCase();
    if (normalizedColor === '#fff' || normalizedColor === '#ffffff' || normalizedColor === 'white') {
        return img;
    }

    const cacheKey = getTintCacheKey(img, color, width, height);
    if (tintedSpriteCache.has(cacheKey)) {
        return tintedSpriteCache.get(cacheKey);
    }

    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));

    _tintCanvas.width = w;
    _tintCanvas.height = h;
    _tintCtx.clearRect(0, 0, w, h);
    _tintCtx.imageSmoothingEnabled = false;
    _tintCtx.drawImage(img, 0, 0, w, h);

    _tintCtx.globalCompositeOperation = 'multiply';
    _tintCtx.fillStyle = normalizedColor;
    _tintCtx.fillRect(0, 0, w, h);

    _tintCtx.globalCompositeOperation = 'destination-in';
    _tintCtx.drawImage(img, 0, 0, w, h);
    _tintCtx.globalCompositeOperation = 'source-over';

    const cached = document.createElement('canvas');
    cached.width = w;
    cached.height = h;
    const cachedCtx = cached.getContext('2d');
    cachedCtx.imageSmoothingEnabled = false;
    cachedCtx.drawImage(_tintCanvas, 0, 0);

    tintedSpriteCache.set(cacheKey, cached);
    if (tintedSpriteCache.size > MAX_TINT_CACHE_ENTRIES) {
        const oldestKey = tintedSpriteCache.keys().next().value;
        tintedSpriteCache.delete(oldestKey);
    }

    return cached;
}

function drawTintedImage(ctx, img, color, x, y, width, height) {
    const tintedSprite = getTintedSprite(img, color, width, height);
    ctx.drawImage(tintedSprite, x, y, width, height);
}

// Load Assets
let objectConfigs = {};
let objectImages = {};

const gooseImg = new Image();
gooseImg.src = 'assets/default_goose.webp';
gooseImg.onload = draw;

function calculateTransparentTrims(img, config) {
    if (!img.naturalWidth || !img.naturalHeight) {
        config.trimScaleX = 1;
        config.trimScaleY = 1;
        return;
    }

    const ALPHA_THRESHOLD = 16;
    const COLOR_TOLERANCE = 24;

    const colorDistance = (r1, g1, b1, r2, g2, b2) => {
        const dr = r1 - r2;
        const dg = g1 - g2;
        const db = b1 - b2;
        return Math.sqrt(dr * dr + dg * dg + db * db);
    };

    const updateBoundsFromPredicate = (canvas, data, predicate) => {
        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = -1;
        let maxY = -1;
        let found = false;

        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                const offset = (y * canvas.width + x) * 4;
                if (predicate(data, offset)) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                    found = true;
                }
            }
        }

        return { minX, minY, maxX, maxY, found };
    };

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let bounds = updateBoundsFromPredicate(canvas, data, (pixelData, offset) => pixelData[offset + 3] >= ALPHA_THRESHOLD);

    const alphaBoundsFullImage = bounds.found
        && bounds.minX === 0
        && bounds.minY === 0
        && bounds.maxX === canvas.width - 1
        && bounds.maxY === canvas.height - 1;

    if (alphaBoundsFullImage) {
        const corners = [
            0,
            ((canvas.width - 1) * 4),
            (((canvas.height - 1) * canvas.width) * 4),
            ((((canvas.height - 1) * canvas.width) + (canvas.width - 1)) * 4)
        ];

        const averageCorner = corners.reduce((acc, offset) => {
            acc.r += data[offset];
            acc.g += data[offset + 1];
            acc.b += data[offset + 2];
            return acc;
        }, { r: 0, g: 0, b: 0 });

        const bgR = averageCorner.r / corners.length;
        const bgG = averageCorner.g / corners.length;
        const bgB = averageCorner.b / corners.length;

        bounds = updateBoundsFromPredicate(canvas, data, (pixelData, offset) => {
            const alpha = pixelData[offset + 3];
            if (alpha < ALPHA_THRESHOLD) return false;
            const dist = colorDistance(pixelData[offset], pixelData[offset + 1], pixelData[offset + 2], bgR, bgG, bgB);
            return dist > COLOR_TOLERANCE;
        });
    }

    if (bounds.found) {
        const minX = bounds.minX;
        const minY = bounds.minY;
        const maxX = bounds.maxX;
        const maxY = bounds.maxY;
        config.trimScaleX = (maxX - minX + 1) / canvas.width;
        config.trimScaleY = (maxY - minY + 1) / canvas.height;
    } else {
        config.trimScaleX = 1;
        config.trimScaleY = 1;
    }
}

async function loadObjectConfigs() {
    try {
        const response = await fetch('objects.json');
        objectConfigs = await response.json();

        const toolbarByCategory = {
            objects: document.getElementById('toolbar'),
            consumables: document.getElementById('consumables-toolbar'),
            decoration: document.getElementById('decoration-toolbar')
        };

        for (const [id, config] of Object.entries(objectConfigs)) {
            const img = new Image();
            img.onload = () => {
                calculateTransparentTrims(img, config);
                draw();
            };
            img.src = config.sprite;
            objectImages[id] = img;
            
            const btn = document.createElement('button');
            btn.className = 'tool-btn';
            btn.dataset.tool = id;
            btn.title = config.name;
            btn.innerHTML = `<img src="${config.icon}" width="24" height="24" style="pointer-events: none;" alt="${config.name}">`;

            const categoryKey = (config.category || 'objects').toLowerCase();
            const targetToolbar = toolbarByCategory[categoryKey] || toolbarByCategory.objects;
            if (targetToolbar) targetToolbar.appendChild(btn);
        }
        
        // Re-bind tool selection logic
        const toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
        toolBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                if (isColorPicking) setColorPickerActive(false);
                if (btn.dataset.tool === 'imageOverlay') {
                    currentTool = 'none';
                    updateToolbarActiveTool();
                    openImageOverlayModal();
                    draw();
                    return;
                }
                toolBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentTool = btn.dataset.tool;
                previewRotation = 0;
                previewScale = 1;
                if (textToolState !== 'idle') cancelTextTool();
                isDrawingBrush = false;
                brushDraftPoints = [];
                if (typeof updatePropertiesPanel === 'function') updatePropertiesPanel();
                draw();
            });
        });
        
        if (typeof loadProgress === 'function') loadProgress();
        draw(); // draw once configs are ready
    } catch (e) {
        console.error("Failed to load objects.json", e);
    }
}
loadObjectConfigs();

// State
let width = window.innerWidth;
let height = window.innerHeight;
let currentTool = 'none'; // 'none' or 'Spikes'
let objects = [];
let birdStart = { x: 100, y: 300 };
let finishLineObj = { type: 'finishLine', x: 1200, y: 0 };
// Global Level Config
let levelConfig = {
    scrollSpeed: 2.4,
    gravity: 0.4,
    floorEnabled: true,
    antigravity: false,
    yTrack: false,
    gradientTopColor: '#009dff',
    gradientBottomColor: '#c2ccff',
    lastUsedColor: '#ff0000'
};

const MAX_UNDO_HISTORY = 500;
let undoStack = [];
let pendingUndoSnapshot = null;
let pendingUndoDirty = false;
let isRestoringUndo = false;

function deepClone(value) {
    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
}

function updateToolbarActiveTool() {
    const toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
    toolBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tool === currentTool));
}

function createSnapshot() {
    const selectedIndices = selectedObjects
        .map(obj => objects.indexOf(obj))
        .filter(idx => idx >= 0);

    return {
        objects: deepClone(objects),
        selectedIndices,
        lassoPolygon: deepClone(lassoPolygon),
        birdStart: deepClone(birdStart),
        finishLineObj: deepClone(finishLineObj),
        levelConfig: deepClone(levelConfig),
        layerState: deepClone(layerState),
        toolPropertyOverrides: deepClone(toolPropertyOverrides),
        previewRotation,
        previewScale
    };
}

function snapshotsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

function pushUndoSnapshot(snapshot) {
    if (isRestoringUndo) return;
    undoStack.push(snapshot);
    if (undoStack.length > MAX_UNDO_HISTORY) {
        undoStack.shift();
    }
}

function restoreSnapshot(snapshot) {
    if (!snapshot) return;

    isRestoringUndo = true;
    objects = deepClone(snapshot.objects || []);
    lassoPolygon = deepClone(snapshot.lassoPolygon || []);
    lassoDraftPoints = [];
    isDrawingLasso = false;
    birdStart = deepClone(snapshot.birdStart || { x: 100, y: 300 });
    finishLineObj = deepClone(snapshot.finishLineObj || { type: 'finishLine', x: 1200, y: 0 });
    levelConfig = deepClone(snapshot.levelConfig || levelConfig);
    layerState = deepClone(snapshot.layerState || layerState);
    const restoredOverrides = deepClone(snapshot.toolPropertyOverrides || {});
    Object.keys(toolPropertyOverrides).forEach(key => delete toolPropertyOverrides[key]);
    Object.assign(toolPropertyOverrides, restoredOverrides);
    previewRotation = snapshot.previewRotation ?? 0;
    previewScale = snapshot.previewScale ?? 1;

    const safeIndices = Array.isArray(snapshot.selectedIndices) ? snapshot.selectedIndices : [];
    selectedObjects = safeIndices.map(idx => objects[idx]).filter(Boolean);
    normalizeLayerStateForObjects();
    sanitizeSelectionForActiveLayer();

    updateToolbarActiveTool();
    if (editorContainer) {
        editorContainer.style.background = `linear-gradient(to bottom, ${levelConfig.gradientTopColor}, ${levelConfig.gradientBottomColor})`;
    }
    renderLayersUI();

    isRestoringUndo = false;
    draw();
}

function beginUndoBatch() {
    if (isRestoringUndo || pendingUndoSnapshot) return;
    pendingUndoSnapshot = createSnapshot();
    pendingUndoDirty = false;
}

function markUndoDirty() {
    if (pendingUndoSnapshot) pendingUndoDirty = true;
}

let saveTimeout;
function saveProgress() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        try {
            if (isRestoringUndo) return;
            const snap = createSnapshot();
            localStorage.setItem('turbogoose_save', JSON.stringify(snap));
        } catch (e) {}
    }, 250);
}

function loadProgress() {
    try {
        const saved = localStorage.getItem('turbogoose_save');
        if (saved) {
            const snap = JSON.parse(saved);
            restoreSnapshot(snap);
        }
    } catch(e) { }
}

function endUndoBatch() {
    if (!pendingUndoSnapshot) return;
    const wasDirty = pendingUndoDirty;
    if (pendingUndoDirty) {
        pushUndoSnapshot(pendingUndoSnapshot);
    }
    pendingUndoSnapshot = null;
    pendingUndoDirty = false;
    if (wasDirty) saveProgress();
}

function runUndoableAction(actionFn) {
    if (isRestoringUndo) {
        actionFn();
        return;
    }
    const before = createSnapshot();
    actionFn();
    const after = createSnapshot();
    if (!snapshotsEqual(before, after)) {
        pushUndoSnapshot(before);
        saveProgress();
    }
}

function performUndo() {
    endUndoBatch();
    if (undoStack.length === 0) return;
    const snapshot = undoStack.pop();
    restoreSnapshot(snapshot);
    saveProgress();
}

function applyLevelConfigFromData(data) {
    if (!data || typeof data !== 'object') return;

    if (typeof data.scrollSpeed === 'number') levelConfig.scrollSpeed = data.scrollSpeed;
    if (typeof data.gravity === 'number') levelConfig.gravity = data.gravity;
    if (typeof data.antigravity === 'boolean') levelConfig.antigravity = data.antigravity;
    if (typeof data.yTrack === 'boolean') levelConfig.yTrack = data.yTrack;
    if (typeof data.gradientTopColor === 'string') levelConfig.gradientTopColor = data.gradientTopColor;
    if (typeof data.gradientBottomColor === 'string') levelConfig.gradientBottomColor = data.gradientBottomColor;

    if (typeof data.floor === 'boolean') {
        levelConfig.floorEnabled = data.floor;
    } else if (typeof data.floorEnabled === 'boolean') {
        levelConfig.floorEnabled = data.floorEnabled;
    }
}

function cloneObjectsForClipboard(items) {
    return deepClone(items.map(obj => ({ ...obj })));
}


// Tool Preview State
let previewX = 0;
let previewY = 0;
let previewRotation = 0;
let previewScale = 1;
let isMouseOnCanvas = false;
let mouseCanvasPos = { x: 0, y: 0 };
let isColorPicking = false;
let hoveredOverlayLayerId = null;
let sampledPickColor = null;

// Selection & Drag State
let selectedObjects = [];
let isDraggingObjects = false;
let isBoxSelecting = false;
let selectionBoxStart = { x: 0, y: 0 };
let selectionBoxEnd = { x: 0, y: 0 };
let lastDrag = { x: 0, y: 0 };
let dragStartMouse = { x: 0, y: 0 };
let dragAnchorStart = { x: 0, y: 0 };
let dragLastAppliedOffset = { x: 0, y: 0 };
let dragSelectionStartStates = [];
let isDraggingOverlay = false;
let overlayDragOffset = { x: 0, y: 0 };

let isTiling = false;
let tileAnchor = { x: 0, y: 0 };
let tiledLocations = new Set();
let lastTileGrid = { x: 0, y: 0 };
let placedTilesThisDrag = new Map();

let isDrawingLasso = false;
let lassoDraftPoints = [];
let lassoPolygon = [];
let lastLassoPoint = null;

// Brush Tool State
let isDrawingBrush = false;
let brushDraftPoints = [];
let brushRadius = 30; // default radius

// Grid Tool State
let activeGrid = null; // null or { cx, cy, w, h, rotation }

function applyGridSnap(x, y) {
    if (!activeGrid) return { x, y };
    
    // Project point into grid space
    const rad = -activeGrid.rotation * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    // Vector from grid center to point
    const dx = x - activeGrid.cx;
    const dy = y - activeGrid.cy;
    
    // Rotate vector to grid space
    const localX = dx * cos - dy * sin;
    const localY = dx * sin + dy * cos;
    
    // Snap to grid intervals with a slight overlap factor to prevent gaps
    const snapW = activeGrid.w * 0.99;
    const snapH = activeGrid.h * 0.99;
    const snappedLocalX = Math.round(localX / snapW) * snapW;
    const snappedLocalY = Math.round(localY / snapH) * snapH;
    
    // Rotate back to world space
    const invRad = activeGrid.rotation * Math.PI / 180;
    const invCos = Math.cos(invRad);
    const invSin = Math.sin(invRad);
    
    const snappedX = activeGrid.cx + snappedLocalX * invCos - snappedLocalY * invSin;
    const snappedY = activeGrid.cy + snappedLocalX * invSin + snappedLocalY * invCos;
    
    return { x: snappedX, y: snappedY };
}

function extractContours(grid, width, height) {
    // Backward-compatible wrapper for binary Uint8Array grids (used by brush tool)
    // Convert binary grid to float alpha field for new marching squares pipeline
    const alpha = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
        alpha[i] = grid[i] ? 1.0 : 0.0;
    }
    
    const segments = marchingSquaresSegments(alpha, width, height, 0.5);
    return connectSegmentsIntoContours(segments);
}

function combineBrushWithLasso() {
    if (brushDraftPoints.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const padding = brushRadius + 20;

    const allPoints = [...(lassoPolygon || []), ...brushDraftPoints];
    if (allPoints.length === 0) return;

    for (const p of allPoints) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    }

    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    const width = maxX - minX;
    const height = maxY - minY;
    if (width <= 0 || height <= 0) return;

    // Cap scale so performance isn't destroyed by huge strokes
    const MAX_DIM = 2000;
    const maxLocalDim = Math.max(width, height);
    const RENDER_SCALE = Math.min(2, MAX_DIM / maxLocalDim);

    const pxW = Math.ceil(width * RENDER_SCALE);
    const pxH = Math.ceil(height * RENDER_SCALE);

    const offCanvas = document.createElement('canvas');
    offCanvas.width = pxW;
    offCanvas.height = pxH;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    // Draw existing selection
    if (lassoPolygon && lassoPolygon.length >= 3) {
        offCtx.fillStyle = '#ffffff';
        offCtx.beginPath();
        offCtx.moveTo((lassoPolygon[0].x - minX) * RENDER_SCALE, (lassoPolygon[0].y - minY) * RENDER_SCALE);
        for (let i = 1; i < lassoPolygon.length; i++) {
            offCtx.lineTo((lassoPolygon[i].x - minX) * RENDER_SCALE, (lassoPolygon[i].y - minY) * RENDER_SCALE);
        }
        offCtx.closePath();
        offCtx.fill('evenodd'); 
    }

    // Draw new brush stroke
    offCtx.strokeStyle = '#ffffff';
    offCtx.lineWidth = brushRadius * 2 * RENDER_SCALE;
    offCtx.lineCap = 'round';
    offCtx.lineJoin = 'round';
    offCtx.beginPath();
    offCtx.moveTo((brushDraftPoints[0].x - minX) * RENDER_SCALE, (brushDraftPoints[0].y - minY) * RENDER_SCALE);
    for (let i = 1; i < brushDraftPoints.length; i++) {
        offCtx.lineTo((brushDraftPoints[i].x - minX) * RENDER_SCALE, (brushDraftPoints[i].y - minY) * RENDER_SCALE);
    }
    if (brushDraftPoints.length === 1) {
        offCtx.lineTo((brushDraftPoints[0].x - minX) * RENDER_SCALE + 0.1, (brushDraftPoints[0].y - minY) * RENDER_SCALE);
    }
    offCtx.stroke();

    const imageData = offCtx.getImageData(0, 0, pxW, pxH);
    const data = imageData.data;
    const grid = new Uint8Array(pxW * pxH);
    for (let i = 0; i < pxW * pxH; i++) {
        grid[i] = data[i * 4 + 3] >= 80 ? 1 : 0;
    }

    const contours = extractContours(grid, pxW, pxH);
    
    // Convert back to world space and simplify
    const pixToWorldX = (px) => minX + px / RENDER_SCALE;
    const pixToWorldY = (py) => minY + py / RENDER_SCALE;

    let allSimplified = contours.map(c => simplifyPolygon(c.map(p => ({
        x: pixToWorldX(p.x),
        y: pixToWorldY(p.y)
    })), 0.5));

    if (allSimplified.length === 0) {
        brushDraftPoints = [];
        return;
    }

    // Stitch all detached contours together
    const stitched = [];
    const root = allSimplified[0][0];

    for (let i = 0; i < allSimplified.length; i++) {
        const poly = allSimplified[i];
        if (i > 0) {
            stitched.push(root, poly[0]);
        }
        stitched.push(...poly);
        stitched.push(poly[0]);
        if (i > 0) {
            stitched.push(root);
        }
    }

    lassoPolygon = stitched;
    brushDraftPoints = [];
}

// Text Tool State
let textToolState = 'idle'; // 'idle', 'editing', 'placed'
let textToolPosition = { x: 0, y: 0 }; // world position of text anchor (center-bottom)
let textToolContent = '';
let textToolFontSize = 80; // base font size in world units
let textToolFont = 'Arial Black, Arial, sans-serif';
let isResizingText = false;
let textResizeStartDist = 0;
let textResizeStartSize = 0;
let textBlinkTimer = null;
let isMovingText = false;
let textMoveStartOffset = { x: 0, y: 0 };

const TEXT_HANDLE_RADIUS = 8; // radius of resize handle in screen px
const TEXT_MIN_FONT_SIZE = 10;
const TEXT_MAX_FONT_SIZE = 800;

function getTextMetrics() {
    const offCtx = document.createElement('canvas').getContext('2d');
    offCtx.font = `bold ${textToolFontSize}px ${textToolFont}`;
    const m = offCtx.measureText(textToolContent || 'A');
    const textW = m.width;
    const textH = textToolFontSize * 1.1;
    return { textW, textH };
}

function getTextBoundingBox() {
    const { textW, textH } = getTextMetrics();
    const x = textToolPosition.x - textW / 2;
    const y = textToolPosition.y - textH;
    return { x, y, w: textW, h: textH };
}

function getTextResizeHandle() {
    const bb = getTextBoundingBox();
    // Bottom-right corner
    return { x: bb.x + bb.w, y: bb.y + bb.h };
}

function isPointOnResizeHandle(worldX, worldY, zoomLevel) {
    if (textToolState !== 'editing' && textToolState !== 'placed') return false;
    if (!textToolContent) return false;
    const handle = getTextResizeHandle();
    const radius = TEXT_HANDLE_RADIUS / zoomLevel;
    const dx = worldX - handle.x;
    const dy = worldY - handle.y;
    return (dx * dx + dy * dy) <= radius * radius;
}

function isPointOnTextTool(worldX, worldY) {
    if (textToolState !== 'editing' && textToolState !== 'placed') return false;
    if (!textToolContent) return false;
    const bb = getTextBoundingBox();
    return worldX >= bb.x && worldX <= bb.x + bb.w && worldY >= bb.y && worldY <= bb.y + bb.h;
}

// ── Gaussian blur (separable, 2-pass) on a Float32Array grid ──
function gaussianBlurFloat(data, width, height, sigma) {
    const radius = Math.ceil(sigma * 3);
    const kernelSize = radius * 2 + 1;
    const kernel = new Float32Array(kernelSize);
    let kSum = 0;
    for (let i = 0; i < kernelSize; i++) {
        const d = i - radius;
        kernel[i] = Math.exp(-(d * d) / (2 * sigma * sigma));
        kSum += kernel[i];
    }
    for (let i = 0; i < kernelSize; i++) kernel[i] /= kSum;

    // Horizontal pass
    const temp = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
            let v = 0;
            for (let k = 0; k < kernelSize; k++) {
                const sx = Math.min(width - 1, Math.max(0, x + k - radius));
                v += data[row + sx] * kernel[k];
            }
            temp[row + x] = v;
        }
    }
    // Vertical pass
    const out = new Float32Array(width * height);
    for (let x = 0; x < width; x++) {
        for (let y = 0; y < height; y++) {
            let v = 0;
            for (let k = 0; k < kernelSize; k++) {
                const sy = Math.min(height - 1, Math.max(0, y + k - radius));
                v += temp[sy * width + x] * kernel[k];
            }
            out[y * width + x] = v;
        }
    }
    return out;
}

// ── Marching Squares with linear interpolation (segment-soup → closed contours) ──
function marchingSquaresSegments(field, width, height, threshold) {
    // For each 2×2 cell, classify and emit interpolated line segments.
    // Returns an array of segments, each segment = [{x,y},{x,y}].
    const segs = [];

    function interp(v1, v2, x1, y1, x2, y2) {
        if (Math.abs(v2 - v1) < 1e-10) return { x: (x1 + x2) * 0.5, y: (y1 + y2) * 0.5 };
        const t = Math.max(0, Math.min(1, (threshold - v1) / (v2 - v1)));
        return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
    }

    for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
            const tl = field[y * width + x];
            const tr = field[y * width + x + 1];
            const br = field[(y + 1) * width + x + 1];
            const bl = field[(y + 1) * width + x];

            const c =
                (tl >= threshold ? 8 : 0) |
                (tr >= threshold ? 4 : 0) |
                (br >= threshold ? 2 : 0) |
                (bl >= threshold ? 1 : 0);

            if (c === 0 || c === 15) continue;

            const top    = interp(tl, tr, x, y, x + 1, y);
            const right  = interp(tr, br, x + 1, y, x + 1, y + 1);
            const bottom = interp(bl, br, x, y + 1, x + 1, y + 1);
            const left   = interp(tl, bl, x, y, x, y + 1);

            switch (c) {
                case  1: segs.push([left, bottom]); break;
                case  2: segs.push([bottom, right]); break;
                case  3: segs.push([left, right]); break;
                case  4: segs.push([right, top]); break;
                case  5: { // saddle BL+TR
                    const avg = (tl + tr + br + bl) * 0.25;
                    if (avg >= threshold) { segs.push([left, top]); segs.push([bottom, right]); }
                    else                  { segs.push([left, bottom]); segs.push([right, top]); }
                    break;
                }
                case  6: segs.push([bottom, top]); break;
                case  7: segs.push([left, top]); break;
                case  8: segs.push([top, left]); break;
                case  9: segs.push([top, bottom]); break;
                case 10: { // saddle TL+BR
                    const avg = (tl + tr + br + bl) * 0.25;
                    if (avg >= threshold) { segs.push([top, right]); segs.push([bottom, left]); }
                    else                  { segs.push([top, left]); segs.push([bottom, right]); }
                    break;
                }
                case 11: segs.push([top, right]); break;
                case 12: segs.push([right, left]); break;
                case 13: segs.push([right, bottom]); break;
                case 14: segs.push([left, bottom]); break;
            }
        }
    }
    return segs;
}

// Connect a soup of line segments into closed contour loops.
// Uses a spatial hash on endpoints so shared edge-crossing points are matched.
function connectSegmentsIntoContours(segments) {
    if (segments.length === 0) return [];

    // Quantise coordinates to a grid key (segments from adjacent marching-squares
    // cells share exact edge-crossing points, but floating-point may differ by ε).
    const Q = 1e4; // quantisation factor
    function key(p) { return `${Math.round(p.x * Q)},${Math.round(p.y * Q)}`; }

    // Adjacency: for every endpoint, store list of { segIdx, otherEnd: point }
    const adj = new Map();
    function addAdj(p, segIdx, other) {
        const k = key(p);
        let list = adj.get(k);
        if (!list) { list = []; adj.set(k, list); }
        list.push({ segIdx, other });
    }

    for (let i = 0; i < segments.length; i++) {
        const [a, b] = segments[i];
        addAdj(a, i, b);
        addAdj(b, i, a);
    }

    const used = new Uint8Array(segments.length);
    const contours = [];

    for (let i = 0; i < segments.length; i++) {
        if (used[i]) continue;
        // Walk forward from segment i
        const loop = [];
        let cur = segments[i][0];
        let next = segments[i][1];
        used[i] = 1;
        loop.push(cur);

        const startKey = key(cur);
        let safety = segments.length + 2;

        while (safety-- > 0) {
            loop.push(next);
            const nk = key(next);
            if (nk === startKey) break; // closed loop

            const list = adj.get(nk);
            if (!list) break;

            let found = false;
            for (const entry of list) {
                if (used[entry.segIdx]) continue;
                used[entry.segIdx] = 1;
                // The shared point is `next`; walk to the other end of that segment
                const [sa, sb] = segments[entry.segIdx];
                const otherEnd = (key(sa) === nk) ? sb : sa;
                next = otherEnd;
                found = true;
                break;
            }
            if (!found) break;
        }

        if (loop.length >= 4) contours.push(loop);
    }

    return contours;
}

// Convert text to polygon using offscreen canvas + contour tracing
function textToPolygon() {
    if (!textToolContent || textToolContent.trim() === '') return [];

    // ── 1. Render text at adaptive high resolution ──
    const MIN_RENDERED_SIZE = 300;
    const RENDER_SCALE = Math.max(2, Math.ceil(MIN_RENDERED_SIZE / Math.max(1, textToolFontSize)));
    const fontSize = textToolFontSize * RENDER_SCALE;
    const padding = Math.max(10, Math.ceil(fontSize * 0.12));

    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
    offCtx.font = `bold ${fontSize}px ${textToolFont}`;
    const metrics = offCtx.measureText(textToolContent);
    const canvasW = Math.ceil(metrics.width) + padding * 2;
    const canvasH = Math.ceil(fontSize * 1.4) + padding * 2;
    offCanvas.width = canvasW;
    offCanvas.height = canvasH;

    offCtx.clearRect(0, 0, canvasW, canvasH);
    offCtx.fillStyle = '#ffffff';
    offCtx.font = `bold ${fontSize}px ${textToolFont}`;
    offCtx.textBaseline = 'top';
    offCtx.fillText(textToolContent, padding, padding);

    // ── 2. Extract alpha channel as normalised float [0,1] ──
    const imageData = offCtx.getImageData(0, 0, canvasW, canvasH);
    const raw = imageData.data;
    const alpha = new Float32Array(canvasW * canvasH);
    for (let i = 0; i < canvasW * canvasH; i++) {
        alpha[i] = raw[i * 4 + 3] / 255.0;
    }

    // ── 3. Gaussian blur for smooth contours ──
    const sigma = Math.max(1.2, RENDER_SCALE * 0.6);
    const blurred = gaussianBlurFloat(alpha, canvasW, canvasH, sigma);

    // ── 4. Marching squares with linear interpolation ──
    const ISO_THRESHOLD = 0.35;
    const segments = marchingSquaresSegments(blurred, canvasW, canvasH, ISO_THRESHOLD);
    const contours = connectSegmentsIntoContours(segments);
    if (contours.length === 0) return [];

    // ── 5. Transform to world space & simplify ──
    const { textW: worldTextW, textH: worldTextH } = getTextMetrics();
    const worldOriginX = textToolPosition.x - worldTextW / 2;
    const worldOriginY = textToolPosition.y - worldTextH;
    const pixToWorldX = (px) => worldOriginX + (px - padding) / RENDER_SCALE;
    const pixToWorldY = (py) => worldOriginY + (py - padding) / RENDER_SCALE;

    // Adaptive simplification: preserve more detail for small text
    const tolerance = textToolFontSize < 40 ? 0.25
                    : textToolFontSize < 100 ? 0.4
                    : 0.6;

    let worldContours = contours
        .map(c => c.map(p => ({ x: pixToWorldX(p.x), y: pixToWorldY(p.y) })))
        .map(c => simplifyPolygon(c, tolerance))
        .filter(c => c.length >= 3);

    if (worldContours.length === 0) return [];

    // ── 6. Sort contours: largest (outer) first, then smaller (holes / inner) ──
    function polyArea(pts) {
        let a = 0;
        for (let i = 0, n = pts.length; i < n; i++) {
            const j = (i + 1) % n;
            a += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
        }
        return Math.abs(a) * 0.5;
    }
    worldContours.sort((a, b) => polyArea(b) - polyArea(a));

    // ── 7. Stitch all contours into one polygon via zero-width bridges ──
    const stitched = [];
    const root = worldContours[0][0];

    for (let i = 0; i < worldContours.length; i++) {
        const poly = worldContours[i];
        if (i > 0) {
            stitched.push(root);
            stitched.push(poly[0]);
        }
        stitched.push(...poly);
        stitched.push(poly[0]); // close sub-loop
        if (i > 0) {
            stitched.push(root);
        }
    }

    return stitched;
}

// Legacy wrappers removed – extractContours / traceContour replaced by
// marchingSquaresSegments + connectSegmentsIntoContours above.

// Douglas-Peucker polygon simplification
function simplifyPolygon(points, tolerance) {
    if (points.length <= 3) return points;

    let maxDist = 0;
    let maxIdx = 0;
    const first = points[0];
    const last = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
        const dist = perpendicularDist(points[i], first, last);
        if (dist > maxDist) {
            maxDist = dist;
            maxIdx = i;
        }
    }

    if (maxDist > tolerance) {
        const left = simplifyPolygon(points.slice(0, maxIdx + 1), tolerance);
        const right = simplifyPolygon(points.slice(maxIdx), tolerance);
        return left.slice(0, -1).concat(right);
    }

    return [first, last];
}

function perpendicularDist(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-9) {
        const ddx = point.x - lineStart.x;
        const ddy = point.y - lineStart.y;
        return Math.sqrt(ddx * ddx + ddy * ddy);
    }
    const t = Math.max(0, Math.min(1, ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / lenSq));
    const projX = lineStart.x + t * dx;
    const projY = lineStart.y + t * dy;
    const ddx = point.x - projX;
    const ddy = point.y - projY;
    return Math.sqrt(ddx * ddx + ddy * ddy);
}

function commitTextToLasso() {
    const polygon = textToPolygon();
    if (polygon.length >= 3) {
        lassoPolygon = polygon;
        textToolState = 'idle';
        textToolContent = '';
        isMovingText = false;
        if (textBlinkTimer) { clearInterval(textBlinkTimer); textBlinkTimer = null; }
        draw();
    }
}

function cancelTextTool() {
    textToolState = 'idle';
    textToolContent = '';
    isResizingText = false;
    isMovingText = false;
    if (textBlinkTimer) { clearInterval(textBlinkTimer); textBlinkTimer = null; }
    draw();
}

let isDeleteTiling = false;
let deleteAnchor = { x: 0, y: 0 };
let deleteCurrentPoint = { x: 0, y: 0 };
let deleteLastPoint = { x: 0, y: 0 };
let deleteSquareMode = false;
let deleteBrushTool = 'none';
let deleteBrushScale = 1;
let deleteBrushRotation = 0;
let deleteBrushRadius = 20;

function getTilingMetrics(tool) {
    if (activeGrid && currentTool !== 'grid' && currentTool !== 'none' && currentTool !== 'lasso' && currentTool !== 'brush' && currentTool !== 'text') {
        return { 
            dims: { w: activeGrid.w, h: activeGrid.h }, 
            scale: 1, 
            rad: activeGrid.rotation * Math.PI / 180 
        };
    }
    const hasTool = tool !== 'none' && objectConfigs[tool];
    const dims = hasTool ? getToolDimensions(tool) : { w: SPIKE_WIDTH, h: SPIKE_WIDTH };
    const scale = hasTool ? getCompensatedScaleMagnitude(tool, previewScale || 1) : 1;
    const rad = (hasTool ? previewRotation : 0) * Math.PI / 180;
    return { dims, scale, rad };
}

function getDeleteTilingMetrics() {
    const hasTool = deleteBrushTool !== 'none' && objectConfigs[deleteBrushTool];
    const dims = hasTool ? getToolDimensions(deleteBrushTool) : { w: SPIKE_WIDTH, h: SPIKE_WIDTH };
    const scale = hasTool ? Math.abs(deleteBrushScale || 1) : 1;
    return { dims, scale };
}

function getObjectBounds(obj) {
    const config = objectConfigs[obj.type];
    const dims = config ? getToolDimensions(obj.type) : { w: SPIKE_WIDTH, h: SPIKE_WIDTH };
    const scale = Math.abs(obj.s || 1);
    const halfW = (dims.w * scale) / 2;
    const halfH = (dims.h * scale) / 2;
    return {
        minX: obj.x - halfW,
        maxX: obj.x + halfW,
        minY: obj.y - halfH,
        maxY: obj.y + halfH
    };
}

function circleIntersectsAabb(cx, cy, r, aabb) {
    const nearestX = Math.max(aabb.minX, Math.min(cx, aabb.maxX));
    const nearestY = Math.max(aabb.minY, Math.min(cy, aabb.maxY));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return (dx * dx + dy * dy) <= (r * r);
}

function deleteObjectsByPredicate(predicate) {
    let didDelete = false;
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (!isObjectEditableInCurrentLayer(obj)) continue;
        if (predicate(obj)) {
            objects.splice(i, 1);
            selectedObjects = selectedObjects.filter(o => o !== obj);
            didDelete = true;
            markUndoDirty();
        }
    }
    return didDelete;
}

function deleteObjectsTouchingBrush(cx, cy, radius) {
    return deleteObjectsByPredicate((obj) => {
        const bounds = getObjectBounds(obj);
        return circleIntersectsAabb(cx, cy, radius, bounds);
    });
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    if (dx === 0 && dy === 0) {
        const ddx = px - x1;
        const ddy = py - y1;
        return Math.sqrt(ddx * ddx + ddy * ddy);
    }
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    const ddx = px - projX;
    const ddy = py - projY;
    return Math.sqrt(ddx * ddx + ddy * ddy);
}

function deleteObjectsTouchingStroke(x1, y1, x2, y2, radius) {
    return deleteObjectsByPredicate((obj) => {
        const bounds = getObjectBounds(obj);
        const centerX = (bounds.minX + bounds.maxX) / 2;
        const centerY = (bounds.minY + bounds.maxY) / 2;
        const halfDiag = Math.sqrt(Math.pow((bounds.maxX - bounds.minX) / 2, 2) + Math.pow((bounds.maxY - bounds.minY) / 2, 2));
        return pointToSegmentDistance(centerX, centerY, x1, y1, x2, y2) <= (radius + halfDiag);
    });
}

function deleteObjectsTouchingRect(x1, y1, x2, y2) {
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    return deleteObjectsByPredicate((obj) => {
        const bounds = getObjectBounds(obj);
        return !(bounds.maxX < minX || bounds.minX > maxX || bounds.maxY < minY || bounds.minY > maxY);
    });
}

function getDeleteBrushRadius() {
    const { dims, scale } = getDeleteTilingMetrics();
    return Math.max(16, Math.min(dims.w * scale, dims.h * scale) * 0.45);
}

function distanceBetweenPoints(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function pointInPolygon(point, polygon) {
    if (!polygon || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x;
        const yi = polygon[i].y;
        const xj = polygon[j].x;
        const yj = polygon[j].y;

        const intersect = ((yi > point.y) !== (yj > point.y))
            && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 1e-9) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function canPreviewLassoFillAt(x, y) {
    if (isFillingLasso) return false;
    if (!lassoPolygon || lassoPolygon.length < 3) return false;
    if (currentTool === 'none' || currentTool === 'lasso' || currentTool === 'text' || currentTool === 'brush' || currentTool === 'grid') return false;
    if (!objectConfigs[currentTool]) return false;
    return pointInPolygon({ x, y }, lassoPolygon);
}

function getPolygonBounds(polygon) {
    const xs = polygon.map(point => point.x);
    const ys = polygon.map(point => point.y);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
    };
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function pointInRotatedRect(point, cx, cy, w, h, rotationDeg) {
    const rad = -rotationDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - cx;
    const dy = point.y - cy;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    return Math.abs(lx) <= w / 2 && Math.abs(ly) <= h / 2;
}

function buildPolygonMask(polygon, preferredScale) {
    if (!polygon || polygon.length < 3) return null;

    const bounds = getPolygonBounds(polygon);
    const spanW = Math.max(1e-3, bounds.maxX - bounds.minX);
    const spanH = Math.max(1e-3, bounds.maxY - bounds.minY);
    let scale = Math.max(0.02, Number(preferredScale) || 1);

    const MAX_DIM = 2800;
    const MAX_PIXELS = 6_000_000;

    // Directly clamp initial scale from selection span so we avoid huge
    // offscreen canvases even for massive selections.
    const dimLimitedScale = MAX_DIM / Math.max(spanW, spanH);
    const pixelLimitedScale = Math.sqrt(MAX_PIXELS / (spanW * spanH));
    if (Number.isFinite(dimLimitedScale)) scale = Math.min(scale, dimLimitedScale);
    if (Number.isFinite(pixelLimitedScale)) scale = Math.min(scale, pixelLimitedScale);
    scale = Math.max(0.02, scale);

    let minX = bounds.minX;
    let minY = bounds.minY;
    let maxX = bounds.maxX;
    let maxY = bounds.maxY;
    let width = 1;
    let height = 1;

    for (let i = 0; i < 60; i++) {
        const paddingWorld = 3 / scale;
        minX = bounds.minX - paddingWorld;
        minY = bounds.minY - paddingWorld;
        maxX = bounds.maxX + paddingWorld;
        maxY = bounds.maxY + paddingWorld;

        width = Math.max(1, Math.ceil((maxX - minX) * scale));
        height = Math.max(1, Math.ceil((maxY - minY) * scale));

        if (width <= MAX_DIM && height <= MAX_DIM && (width * height) <= MAX_PIXELS) {
            break;
        }
        scale = Math.max(0.01, scale * 0.82);
    }

    if (width > MAX_DIM || height > MAX_DIM || (width * height) > MAX_PIXELS) {
        return null;
    }

    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    offCtx.clearRect(0, 0, width, height);
    offCtx.fillStyle = '#ffffff';
    offCtx.beginPath();
    offCtx.moveTo((polygon[0].x - minX) * scale, (polygon[0].y - minY) * scale);
    for (let i = 1; i < polygon.length; i++) {
        offCtx.lineTo((polygon[i].x - minX) * scale, (polygon[i].y - minY) * scale);
    }
    offCtx.closePath();
    offCtx.fill('evenodd');

    const imageData = offCtx.getImageData(0, 0, width, height);
    const alphaData = imageData.data;
    const inside = new Uint8Array(width * height);
    let insideCount = 0;

    for (let i = 0; i < inside.length; i++) {
        const isInside = alphaData[i * 4 + 3] >= 64;
        inside[i] = isInside ? 1 : 0;
        if (isInside) insideCount++;
    }

    if (insideCount === 0) return null;

    return {
        minX,
        minY,
        maxX,
        maxY,
        width,
        height,
        scale,
        inside,
        insideCount
    };
}

function buildRotatedRectFootprint(mask, worldW, worldH, rotationDeg) {
    const halfW = (worldW * mask.scale) / 2;
    const halfH = (worldH * mask.scale) / 2;
    if (halfW < 0.2 || halfH < 0.2) return null;

    const rad = rotationDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const radiusX = Math.max(1, Math.ceil(Math.abs(halfW * cos) + Math.abs(halfH * sin)) + 1);
    const radiusY = Math.max(1, Math.ceil(Math.abs(halfW * sin) + Math.abs(halfH * cos)) + 1);

    if ((radiusX * 2 + 1) * (radiusY * 2 + 1) > 1_500_000) return null;

    const insetPx = 0.35;
    const maxLocalX = Math.max(0.25, halfW - insetPx);
    const maxLocalY = Math.max(0.25, halfH - insetPx);

    const deltas = [];
    let minDx = Infinity;
    let maxDx = -Infinity;
    let minDy = Infinity;
    let maxDy = -Infinity;

    for (let dy = -radiusY; dy <= radiusY; dy++) {
        for (let dx = -radiusX; dx <= radiusX; dx++) {
            const localX = dx * cos + dy * sin;
            const localY = -dx * sin + dy * cos;
            if (Math.abs(localX) > maxLocalX || Math.abs(localY) > maxLocalY) continue;

            deltas.push(dy * mask.width + dx);
            if (dx < minDx) minDx = dx;
            if (dx > maxDx) maxDx = dx;
            if (dy < minDy) minDy = dy;
            if (dy > maxDy) maxDy = dy;
        }
    }

    if (deltas.length === 0) return null;

    return {
        deltas: Int32Array.from(deltas),
        minDx,
        maxDx,
        minDy,
        maxDy,
        area: deltas.length
    };
}

function* iterateRotatedLatticeCenters(mask, rotationDeg, stepXWorld, stepYWorld, phaseU, phaseV) {
    const rad = rotationDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const corners = [
        { x: mask.minX, y: mask.minY },
        { x: mask.maxX, y: mask.minY },
        { x: mask.maxX, y: mask.maxY },
        { x: mask.minX, y: mask.maxY }
    ];

    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;

    for (const corner of corners) {
        const u = corner.x * cos + corner.y * sin;
        const v = -corner.x * sin + corner.y * cos;
        if (u < minU) minU = u;
        if (u > maxU) maxU = u;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
    }

    const centerX = (mask.minX + mask.maxX) * 0.5;
    const centerY = (mask.minY + mask.maxY) * 0.5;
    const originU = centerX * cos + centerY * sin;
    const originV = -centerX * sin + centerY * cos;

    const uMinIndex = Math.floor((minU - originU) / stepXWorld) - 2;
    const uMaxIndex = Math.ceil((maxU - originU) / stepXWorld) + 2;
    const vMinIndex = Math.floor((minV - originV) / stepYWorld) - 2;
    const vMaxIndex = Math.ceil((maxV - originV) / stepYWorld) + 2;

    for (let vi = vMinIndex; vi <= vMaxIndex; vi++) {
        const v = originV + (vi + phaseV) * stepYWorld;
        for (let ui = uMinIndex; ui <= uMaxIndex; ui++) {
            const u = originU + (ui + phaseU) * stepXWorld;
            const worldX = u * cos - v * sin;
            const worldY = u * sin + v * cos;
            const maskX = Math.round((worldX - mask.minX) * mask.scale);
            const maskY = Math.round((worldY - mask.minY) * mask.scale);

            if (maskX < 0 || maskY < 0 || maskX >= mask.width || maskY >= mask.height) continue;
            yield { maskX, maskY };
        }
    }
}

function evaluatePlacementGain(mask, coveredMask, centerIndex, centerX, centerY, footprint) {
    if (
        centerX + footprint.minDx < 0 ||
        centerX + footprint.maxDx >= mask.width ||
        centerY + footprint.minDy < 0 ||
        centerY + footprint.maxDy >= mask.height
    ) {
        return -1;
    }

    let gain = 0;
    for (let i = 0; i < footprint.deltas.length; i++) {
        const index = centerIndex + footprint.deltas[i];
        if (!mask.inside[index]) return -1;
        if (!coveredMask[index]) gain++;
    }
    return gain;
}

function applyPlacementCoverage(mask, coveredMask, centerIndex, footprint) {
    let gained = 0;
    for (let i = 0; i < footprint.deltas.length; i++) {
        const index = centerIndex + footprint.deltas[i];
        if (mask.inside[index] && !coveredMask[index]) {
            coveredMask[index] = 1;
            gained++;
        }
    }
    return gained;
}

function buildScaleFractions(minFraction) {
    const floor = clamp(minFraction, 0.05, 1);
    const scales = [1];
    let current = 1;

    while (current > floor) {
        current *= 0.84;
        if (current < floor) current = floor;
        scales.push(Number(current.toFixed(4)));
        if (current === floor) break;
    }

    return Array.from(new Set(scales));
}

function normalizeDegrees360(angleDeg) {
    let angle = Number(angleDeg) || 0;
    angle %= 360;
    if (angle < 0) angle += 360;
    return angle;
}

function quantizeAngle(angleDeg, stepDeg = 10) {
    return normalizeDegrees360(Math.round((Number(angleDeg) || 0) / stepDeg) * stepDeg);
}

function estimateUncoveredOrientation(mask, coveredMask, cx, cy, radiusPx, fallbackDeg) {
    const r = Math.max(2, Math.floor(radiusPx));
    const minX = Math.max(0, cx - r);
    const maxX = Math.min(mask.width - 1, cx + r);
    const minY = Math.max(0, cy - r);
    const maxY = Math.min(mask.height - 1, cy + r);

    let count = 0;
    let sumX = 0;
    let sumY = 0;

    for (let y = minY; y <= maxY; y++) {
        const row = y * mask.width;
        for (let x = minX; x <= maxX; x++) {
            const dx = x - cx;
            const dy = y - cy;
            if ((dx * dx + dy * dy) > (r * r)) continue;

            const idx = row + x;
            if (!mask.inside[idx] || coveredMask[idx]) continue;
            count++;
            sumX += x;
            sumY += y;
        }
    }

    if (count < 8) return normalizeDegrees360(fallbackDeg);

    const meanX = sumX / count;
    const meanY = sumY / count;

    let cxx = 0;
    let cxy = 0;
    let cyy = 0;

    for (let y = minY; y <= maxY; y++) {
        const row = y * mask.width;
        for (let x = minX; x <= maxX; x++) {
            const dx0 = x - cx;
            const dy0 = y - cy;
            if ((dx0 * dx0 + dy0 * dy0) > (r * r)) continue;

            const idx = row + x;
            if (!mask.inside[idx] || coveredMask[idx]) continue;

            const dx = x - meanX;
            const dy = y - meanY;
            cxx += dx * dx;
            cxy += dx * dy;
            cyy += dy * dy;
        }
    }

    const anisotropy = Math.abs(cxx - cyy) + Math.abs(cxy) * 2;
    if (anisotropy < 1e-6) return normalizeDegrees360(fallbackDeg);

    const angleRad = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    return normalizeDegrees360(angleRad * 180 / Math.PI);
}

function buildAdaptiveRotationCandidates(preferredDeg, baseDeg, visualW, visualH) {
    const aspect = Math.max(0.01, Math.max(visualW, visualH) / Math.max(0.01, Math.min(visualW, visualH)));
    const seed = aspect > 1.3
        ? [preferredDeg, preferredDeg + 180, preferredDeg + 22.5, preferredDeg - 22.5, preferredDeg + 90, preferredDeg - 90, baseDeg]
        : [preferredDeg, preferredDeg + 180, preferredDeg + 90, preferredDeg - 90, baseDeg];

    const out = [];
    const seen = new Set();
    for (const angle of seed) {
        const q = quantizeAngle(angle, 10);
        const key = q.toFixed(3);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(q);
    }

    return out;
}

async function fillLassoWithCurrentTool() {
    if (!lassoPolygon || lassoPolygon.length < 3) return { placed: 0, timedOut: false };
    if (!objectConfigs[currentTool]) return { placed: 0, timedOut: false };
    if (isActiveLayerObjectLocked()) return { placed: 0, timedOut: false };

    const startedAt = performance.now();
    let lastUiUpdateAt = startedAt;
    let stepsSinceYield = 0;
    let timedOut = false;
    let placedCount = 0;

    const checkTimeout = () => {
        if ((performance.now() - startedAt) > FILL_TIMEOUT_MS) {
            timedOut = true;
            return true;
        }
        return false;
    };

    const dims = getToolDimensions(currentTool);
    const baseRawScale = Math.max(0.005, Math.abs(previewScale || 1));
    const baseVisualScale = getCompensatedScaleMagnitude(currentTool, previewScale || 1);
    const baseW = Math.max(1, dims.w * baseVisualScale);
    const baseH = Math.max(1, dims.h * baseVisualScale);
    const baseRotationDeg = Number(previewRotation || 0);

    // Mask resolution tracks object size so we preserve shape fidelity while
    // keeping fill solve time bounded for large selections.
    const maskScale = clamp(12 / Math.max(6, Math.min(baseW, baseH)), 0.8, 4.5);
    const mask = buildPolygonMask(lassoPolygon, maskScale);
    if (!mask || mask.insideCount === 0) return;

    const coveredMask = new Uint8Array(mask.width * mask.height);
    let uncoveredCount = mask.insideCount;

    const baseAreaPx = Math.max(1, Math.round(baseW * mask.scale) * Math.round(baseH * mask.scale));
    const lowerBound = Math.max(1, Math.ceil(mask.insideCount / baseAreaPx));
    const maxObjects = Math.min(24000, Math.max(900, lowerBound * 14 + 450));

    showFillProgress('Filling Selection', 0, maxObjects, performance.now() - startedAt);

    const flushUi = async (forceDraw = false) => {
        const now = performance.now();
        if (!forceDraw && (now - lastUiUpdateAt) < FILL_UI_UPDATE_INTERVAL_MS) return;
        lastUiUpdateAt = now;
        showFillProgress('Filling Selection', placedCount, maxObjects, now - startedAt);
        draw();
        await yieldToUi();
    };

    const placeChunked = async (x, y, rotation, rawScale) => {
        if (objects.length >= maxObjects) return false;
        objects.push(createPlacedObject(currentTool, x, y, rotation, rawScale));
        placedCount++;
        markUndoDirty();

        if (placedCount % FILL_PLACEMENT_CHUNK === 0) {
            await flushUi(true);
        }
        return true;
    };

    const minScaleFraction = Math.max(0.08, Math.min(0.35, 3 / Math.max(baseW, baseH)));
    const scaleFractions = buildScaleFractions(minScaleFraction);

    for (const fraction of scaleFractions) {
        if (objects.length >= maxObjects || uncoveredCount <= 0 || checkTimeout()) break;

        const rawScale = baseRawScale * fraction;
        const visualScale = getCompensatedScaleMagnitude(currentTool, rawScale);
        const tileW = Math.max(1 / mask.scale, dims.w * visualScale);
        const tileH = Math.max(1 / mask.scale, dims.h * visualScale);
        const footprintCache = new Map();
        const getFootprintForAngle = (angle) => {
            const key = quantizeAngle(angle, 10).toFixed(3);
            if (footprintCache.has(key)) return footprintCache.get(key);
            const fp = buildRotatedRectFootprint(mask, tileW, tileH, Number(key));
            const record = fp ? { angle: Number(key), footprint: fp } : null;
            footprintCache.set(key, record);
            return record;
        };

        const stepFactor = fraction >= 0.7
            ? 0.95
            : fraction >= 0.45
                ? 0.86
                : fraction >= 0.28
                    ? 0.74
                    : 0.62;

        const stepX = Math.max(1 / mask.scale, tileW * stepFactor);
        const stepY = Math.max(1 / mask.scale, tileH * stepFactor);

        const phasePairs = fraction >= 0.55
            ? [[0, 0], [0.5, 0.5]]
            : fraction >= 0.3
                ? [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]
                : [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];

        const warmupAngles = buildAdaptiveRotationCandidates(baseRotationDeg, baseRotationDeg, tileW, tileH);
        const warmupCandidates = warmupAngles.map(a => getFootprintForAngle(a)).filter(Boolean);
        if (warmupCandidates.length === 0) continue;
        const maxFootprintArea = Math.max(...warmupCandidates.map(c => c.footprint.area));
        const minGain = Math.max(1, Math.floor(maxFootprintArea * (fraction >= 0.55 ? 0.28 : fraction >= 0.3 ? 0.12 : 0.03)));
        const seenCenters = new Set();

        for (const [phaseU, phaseV] of phasePairs) {
            if (objects.length >= maxObjects || uncoveredCount <= 0 || checkTimeout()) break;

            for (const center of iterateRotatedLatticeCenters(mask, baseRotationDeg, stepX, stepY, phaseU, phaseV)) {
                if (objects.length >= maxObjects || uncoveredCount <= 0 || checkTimeout()) break;

                stepsSinceYield++;
                if (stepsSinceYield >= FILL_YIELD_EVERY_STEPS) {
                    stepsSinceYield = 0;
                    await flushUi(false);
                }

                const maskX = center.maskX;
                const maskY = center.maskY;

                const centerIndex = maskY * mask.width + maskX;
                if (seenCenters.has(centerIndex)) continue;
                seenCenters.add(centerIndex);

                if (!mask.inside[centerIndex]) continue;

                const localPreferred = estimateUncoveredOrientation(mask, coveredMask, maskX, maskY, Math.max(6, Math.min(tileW, tileH) * mask.scale * 0.9), baseRotationDeg);
                const angles = buildAdaptiveRotationCandidates(localPreferred, baseRotationDeg, tileW, tileH);

                let bestCandidate = null;
                let bestGain = -1;

                for (const angle of angles) {
                    const candidate = getFootprintForAngle(angle);
                    if (!candidate) continue;
                    const gain = evaluatePlacementGain(mask, coveredMask, centerIndex, maskX, maskY, candidate.footprint);
                    if (gain > bestGain) {
                        bestGain = gain;
                        bestCandidate = candidate;
                    }
                }

                if (!bestCandidate || bestGain < minGain) continue;

                const gained = applyPlacementCoverage(mask, coveredMask, centerIndex, bestCandidate.footprint);
                if (gained <= 0) continue;

                uncoveredCount -= gained;
                const ok = await placeChunked(
                    Number((mask.minX + maskX / mask.scale).toFixed(2)),
                    Number((mask.minY + maskY / mask.scale).toFixed(2)),
                    Number(bestCandidate.angle.toFixed(2)),
                    Number(rawScale.toFixed(3))
                );
                if (!ok) break;
            }
        }
    }

    // Fallback pass: directly target remaining uncovered pixels with the
    // smallest scales discovered above.
    if (uncoveredCount > 0 && objects.length < maxObjects && !timedOut) {
        const fallbackFractions = scaleFractions.slice(-Math.min(3, scaleFractions.length));

        for (const fraction of fallbackFractions) {
            if (objects.length >= maxObjects || uncoveredCount <= 0 || checkTimeout()) break;

            const rawScale = baseRawScale * fraction;
            const visualScale = getCompensatedScaleMagnitude(currentTool, rawScale);
            const tileW = Math.max(1 / mask.scale, dims.w * visualScale);
            const tileH = Math.max(1 / mask.scale, dims.h * visualScale);
            const footprintCache = new Map();
            const getFootprintForAngle = (angle) => {
                const key = quantizeAngle(angle, 10).toFixed(3);
                if (footprintCache.has(key)) return footprintCache.get(key);
                const fp = buildRotatedRectFootprint(mask, tileW, tileH, Number(key));
                const record = fp ? { angle: Number(key), footprint: fp } : null;
                footprintCache.set(key, record);
                return record;
            };

            const warmupAngles = buildAdaptiveRotationCandidates(baseRotationDeg, baseRotationDeg, tileW, tileH);
            const hasAny = warmupAngles.some(a => !!getFootprintForAngle(a));
            if (!hasAny) continue;

            const stride = fraction <= fallbackFractions[fallbackFractions.length - 1] ? 1 : 2;

            for (let y = 0; y < mask.height; y += stride) {
                if (objects.length >= maxObjects || uncoveredCount <= 0 || checkTimeout()) break;
                for (let x = 0; x < mask.width; x += stride) {
                    if (objects.length >= maxObjects || uncoveredCount <= 0 || checkTimeout()) break;

                    stepsSinceYield++;
                    if (stepsSinceYield >= FILL_YIELD_EVERY_STEPS) {
                        stepsSinceYield = 0;
                        await flushUi(false);
                    }

                    const centerIndex = y * mask.width + x;
                    if (!mask.inside[centerIndex] || coveredMask[centerIndex]) continue;

                    const localPreferred = estimateUncoveredOrientation(mask, coveredMask, x, y, Math.max(6, Math.min(tileW, tileH) * mask.scale), baseRotationDeg);
                    const angles = buildAdaptiveRotationCandidates(localPreferred, baseRotationDeg, tileW, tileH);

                    let bestCandidate = null;
                    let bestGain = -1;

                    for (const angle of angles) {
                        const candidate = getFootprintForAngle(angle);
                        if (!candidate) continue;
                        const gain = evaluatePlacementGain(mask, coveredMask, centerIndex, x, y, candidate.footprint);
                        if (gain > bestGain) {
                            bestGain = gain;
                            bestCandidate = candidate;
                        }
                    }
                    if (!bestCandidate || bestGain <= 0) continue;

                    const gained = applyPlacementCoverage(mask, coveredMask, centerIndex, bestCandidate.footprint);
                    if (gained <= 0) continue;

                    uncoveredCount -= gained;
                    const ok = await placeChunked(
                        Number((mask.minX + x / mask.scale).toFixed(2)),
                        Number((mask.minY + y / mask.scale).toFixed(2)),
                        Number(bestCandidate.angle.toFixed(2)),
                        Number(rawScale.toFixed(3))
                    );
                    if (!ok) break;
                }
            }
        }
    }

    await flushUi(true);

    if (timedOut) {
        return { placed: placedCount, timedOut: true };
    }

    return { placed: placedCount, timedOut: false };
}

function forEachTileCell(targetGridX, targetGridY, squareMode, callback) {
    if (squareMode) {
        const minX = Math.min(0, targetGridX);
        const maxX = Math.max(0, targetGridX);
        const minY = Math.min(0, targetGridY);
        const maxY = Math.max(0, targetGridY);
        for (let gx = minX; gx <= maxX; gx++) {
            for (let gy = minY; gy <= maxY; gy++) {
                callback(gx, gy);
            }
        }
        return;
    }

    callback(targetGridX, targetGridY);
}

function getWorldPositionFromTile(anchor, gx, gy, cellW, cellH, rad) {
    return {
        x: anchor.x + (gx * cellW * Math.cos(rad) - gy * cellH * Math.sin(rad)),
        y: anchor.y + (gx * cellW * Math.sin(rad) + gy * cellH * Math.cos(rad))
    };
}

function getGridCellsOnLine(x0, y0, x1, y1) {
    const cells = [];
    let gx0 = x0;
    let gy0 = y0;
    const gx1 = x1;
    const gy1 = y1;

    const dx = Math.abs(gx1 - gx0);
    const sx = gx0 < gx1 ? 1 : -1;
    const dy = -Math.abs(gy1 - gy0);
    const sy = gy0 < gy1 ? 1 : -1;
    let err = dx + dy;

    while (true) {
        cells.push({ x: gx0, y: gy0 });
        if (gx0 === gx1 && gy0 === gy1) break;
        const e2 = 2 * err;
        if (e2 >= dy) {
            err += dy;
            gx0 += sx;
        }
        if (e2 <= dx) {
            err += dx;
            gy0 += sy;
        }
    }

    return cells;
}

function removeTileFromCurrentDrag(locId) {
    const obj = placedTilesThisDrag.get(locId);
    if (!obj) return;

    const objIndex = objects.indexOf(obj);
    if (objIndex !== -1) {
        objects.splice(objIndex, 1);
        selectedObjects = selectedObjects.filter(o => o !== obj);
        markUndoDirty();
    }

    placedTilesThisDrag.delete(locId);
    tiledLocations.delete(locId);
}

function placeTileAtGrid(gx, gy, cellW, cellH, rad) {
    const locId = `${gx},${gy}`;
    if (tiledLocations.has(locId)) return;

    const worldPos = getWorldPositionFromTile(tileAnchor, gx, gy, cellW, cellH, rad);
    const placedObj = placeObjectAtWorld(worldPos.x, worldPos.y);
    tiledLocations.add(locId);
    placedTilesThisDrag.set(locId, placedObj);
}

function updateSquarePlacement(gridX, gridY, cellW, cellH, rad) {
    const minX = Math.min(0, gridX);
    const maxX = Math.max(0, gridX);
    const minY = Math.min(0, gridY);
    const maxY = Math.max(0, gridY);

    const targetLocIds = new Set();
    for (let gx = minX; gx <= maxX; gx++) {
        for (let gy = minY; gy <= maxY; gy++) {
            targetLocIds.add(`${gx},${gy}`);
        }
    }

    for (const locId of Array.from(placedTilesThisDrag.keys())) {
        if (!targetLocIds.has(locId)) {
            removeTileFromCurrentDrag(locId);
        }
    }

    for (let gx = minX; gx <= maxX; gx++) {
        for (let gy = minY; gy <= maxY; gy++) {
            placeTileAtGrid(gx, gy, cellW, cellH, rad);
        }
    }
}

function placeObjectAtWorld(x, y) {
    if (isActiveLayerObjectLocked()) return null;
    const obj = createPlacedObject(currentTool, x, y, previewRotation, previewScale);
    objects.push(obj);
    markUndoDirty();
    return obj;
}

function getToolDimensions(tool) {
    const config = objectConfigs[tool];
    if (config) {
        const img = objectImages[tool];
        let w = config.width || SPIKE_WIDTH;
        let h = w;

        if ((config.trimScaleX === undefined || config.trimScaleY === undefined) && img && img.complete) {
            calculateTransparentTrims(img, config);
        }

        if (img) {
            if (config.heightMode === 'aspect') {
                const imgW = img.naturalWidth || img.width;
                const imgH = img.naturalHeight || img.height;
                if (imgW > 0) {
                    h = imgH * (w / imgW);
                } else {
                    h = 48;
                }
            } else if (config.heightMode === 'native' || config.heightMode === undefined && !config.width) {
                h = img.naturalHeight || img.height || w;
            }
        }
        return {
            w: (w * (config.trimScaleX || 1)) * (config.tileWidthMod || 1),
            h: (h * (config.trimScaleY || 1)) * (config.tileHeightMod || 1)
        };
    }
    return { w: 50, h: 50 };
}

function getRenderDimensions(tool) {
    const config = objectConfigs[tool];
    if (config) {
        const img = objectImages[tool];
        let w = config.width || SPIKE_WIDTH;
        let h = w;

        const baseW = img ? (img.naturalWidth || img.width) : 0;
        const baseH = img ? (img.naturalHeight || img.height) : 0;

        if (img && img.complete && baseW !== 0) {
            if (config.heightMode === 'aspect') {
                h = baseH * (w / baseW);
            } else if (config.heightMode === 'native' || config.heightMode === undefined && !config.width) {
                h = baseH;
            }
        }

        return { w, h };
    }
    return { w: 50, h: 50 };
}

function getCompensatedRenderScale(tool, signedScale) {
    const COMPENSATION_STRENGTH = 0.4;
    const sign = signedScale < 0 ? -1 : 1;
    const magnitude = Math.max(0.005, Math.abs(signedScale || 1));

    // Keep downscaling linear so no object type gets an artificial minimum size.
    if (magnitude < 1) {
        return sign * magnitude;
    }

    if (magnitude === 1) {
        return sign;
    }

    const renderDims = getRenderDimensions(tool);
    const logicalDims = getToolDimensions(tool);
    const ratioX = renderDims.w > 0 ? (logicalDims.w / renderDims.w) : 1;
    const ratioY = renderDims.h > 0 ? (logicalDims.h / renderDims.h) : 1;
    const growthRatio = Math.max(0.1, Math.min(3, (ratioX + ratioY) / 2));
    const effectiveGrowthRatio = 1 + ((growthRatio - 1) * COMPENSATION_STRENGTH);

    const compensatedMagnitude = 1 + ((magnitude - 1) * effectiveGrowthRatio);
    return sign * compensatedMagnitude;
}

function getCompensatedScaleMagnitude(tool, signedScale) {
    return Math.abs(getCompensatedRenderScale(tool, signedScale));
}

function rgbToHex(r, g, b) {
    const toHex = (value) => Math.max(0, Math.min(255, value | 0)).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function hexToRgb(hex) {
    if (typeof hex !== 'string') return null;
    const raw = hex.trim();
    if (!raw.startsWith('#')) return null;
    const value = raw.slice(1);
    if (value.length === 3) {
        const r = parseInt(value[0] + value[0], 16);
        const g = parseInt(value[1] + value[1], 16);
        const b = parseInt(value[2] + value[2], 16);
        if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
        return { r, g, b };
    }
    if (value.length === 6) {
        const r = parseInt(value.slice(0, 2), 16);
        const g = parseInt(value.slice(2, 4), 16);
        const b = parseInt(value.slice(4, 6), 16);
        if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return null;
        return { r, g, b };
    }
    return null;
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function getBackgroundColorAtScreen(screenY) {
    const top = hexToRgb(levelConfig.gradientTopColor) || { r: 0, g: 157, b: 255 };
    const bottom = hexToRgb(levelConfig.gradientBottomColor) || { r: 194, g: 204, b: 255 };
    const h = Math.max(1, canvas.height - 1);
    const t = Math.max(0, Math.min(1, screenY / h));
    return rgbToHex(
        Math.round(lerp(top.r, bottom.r, t)),
        Math.round(lerp(top.g, bottom.g, t)),
        Math.round(lerp(top.b, bottom.b, t))
    );
}

function sampleCanvasColorAtScreen(x, y) {
    const px = Math.max(0, Math.min(canvas.width - 1, Math.round(x)));
    const py = Math.max(0, Math.min(canvas.height - 1, Math.round(y)));
    try {
        const pixel = ctx.getImageData(px, py, 1, 1).data;
        if (!pixel || pixel.length < 4 || pixel[3] === 0) return null;
        return rgbToHex(pixel[0], pixel[1], pixel[2]);
    } catch (err) {
        return null;
    }
}

function getObjectsAtPointInLayer(layerId, x, y) {
    const hits = [];
    for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        if (!obj || !obj.type || obj.layerId !== layerId) continue;
        const config = objectConfigs[obj.type];
        if (!config) continue;

        const dims = getRenderDimensions(obj.type);
        const visualScale = getCompensatedScaleMagnitude(obj.type, obj.s || 1);
        const w = dims.w * visualScale;
        const h = dims.h * visualScale;

        if (!pointInRotatedRect({ x, y }, obj.x, obj.y, w, h, obj.rotation || 0)) continue;
        hits.push({ obj, index: i });
    }

    hits.sort((a, b) => {
        const za = Number.isFinite(a.obj.z) ? a.obj.z : 0;
        const zb = Number.isFinite(b.obj.z) ? b.obj.z : 0;
        if (za !== zb) return zb - za;
        return b.index - a.index;
    });

    return hits.map(hit => hit.obj);
}

function getTopUnlayeredObjectAtPoint(x, y) {
    const hits = [];
    for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        if (!obj || !obj.type || getLayerById(obj.layerId)) continue;
        const config = objectConfigs[obj.type];
        if (!config) continue;

        const dims = getRenderDimensions(obj.type);
        const visualScale = getCompensatedScaleMagnitude(obj.type, obj.s || 1);
        const w = dims.w * visualScale;
        const h = dims.h * visualScale;

        if (!pointInRotatedRect({ x, y }, obj.x, obj.y, w, h, obj.rotation || 0)) continue;
        hits.push({ obj, index: i });
    }

    hits.sort((a, b) => {
        const za = Number.isFinite(a.obj.z) ? a.obj.z : 0;
        const zb = Number.isFinite(b.obj.z) ? b.obj.z : 0;
        if (za !== zb) return zb - za;
        return b.index - a.index;
    });

    return hits.length > 0 ? hits[0].obj : null;
}

function getOverlayLayerAtPoint(x, y) {
    for (let i = 0; i < layerState.items.length; i++) {
        const layer = layerState.items[i];
        if (!isOverlayLayer(layer) || layer.hidden) continue;
        const overlay = layer.overlay;
        if (!overlay || !overlay.src) continue;

        const img = getOverlayImageForLayer(layer);
        const overlayScale = Math.max(OVERLAY_MIN_SCALE, Number(overlay.scale) || 1);
        const baseW = (img && img.naturalWidth) ? img.naturalWidth : 300;
        const baseH = (img && img.naturalHeight) ? img.naturalHeight : 200;
        const drawW = baseW * overlayScale;
        const drawH = baseH * overlayScale;

        if (pointInRotatedRect({ x, y }, overlay.x || 0, overlay.y || 0, drawW, drawH, overlay.rotation || 0)) {
            return layer;
        }
    }
    return null;
}

function getTopPickTargetAtPoint(x, y) {
    const unlayered = getTopUnlayeredObjectAtPoint(x, y);
    if (unlayered) return { kind: 'object', obj: unlayered };

    for (let i = 0; i < layerState.items.length; i++) {
        const layer = layerState.items[i];
        if (!layer || layer.hidden) continue;

        if (isOverlayLayer(layer)) {
            const overlayHit = getOverlayLayerAtPoint(x, y);
            if (overlayHit && overlayHit.id === layer.id) {
                return { kind: 'overlay', layer };
            }
            continue;
        }

        const hits = getObjectsAtPointInLayer(layer.id, x, y);
        if (hits.length > 0) {
            return { kind: 'object', obj: hits[0] };
        }
    }

    return null;
}

function resolvePickColorAtPoint(gameX, gameY, screenX, screenY) {
    const target = getTopPickTargetAtPoint(gameX, gameY);
    if (target && target.kind === 'object') {
        const config = objectConfigs[target.obj.type];
        if (config && config.colorable && target.obj.color) {
            return target.obj.color;
        }
    }

    const sampled = sampleCanvasColorAtScreen(screenX, screenY);
    if (sampled) return sampled;
    return getBackgroundColorAtScreen(screenY);
}

function applyColorToCurrentContext(val) {
    const color = typeof val === 'string' ? val : '#ffffff';
    levelConfig.lastUsedColor = color;

    if (selectedObjects.length > 0) {
        selectedObjects.forEach(obj => {
            if (objectConfigs[obj.type] && objectConfigs[obj.type].colorable) {
                obj.color = color;
            }
        });
    }

    if (propColorInput) propColorInput.value = color;
}

function setColorPickerActive(active) {
    isColorPicking = !!active;
    sampledPickColor = null;
    if (propColorPickerBtn) {
        propColorPickerBtn.classList.toggle('active', isColorPicking);
        propColorPickerBtn.title = isColorPicking
            ? 'Click a color on the canvas to apply'
            : 'Pick Color From Screen or Reference';
    }
    canvas.style.cursor = isColorPicking ? 'crosshair' : 'default';
    if (!isColorPicking) hoveredOverlayLayerId = null;
    draw();
}

// Resize canvas
function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
    
    // Position bird start exactly per specifications
    birdStart = { x: 100, y: 300 };
    
    draw();
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// UI Elements
const togglePanelBtn = document.getElementById('toggle-panel');
const rightPanel = document.getElementById('right-panel');
const undoBtn = document.getElementById('undo-btn');
const exportBtn = document.getElementById('export-btn');
const clearBtn = document.getElementById('clear-btn');

setupLeftPanelToggle();
setupLeftPanelResize();
setupLayersUI();
setupImageOverlayModal();

// Toggle panel
togglePanelBtn.addEventListener('click', () => {
    rightPanel.classList.toggle('closed');
    togglePanelBtn.textContent = rightPanel.classList.contains('closed') ? '◀' : '▶';
});

if (undoBtn) {
    undoBtn.addEventListener('click', () => {
        performUndo();
    });
}

if (clearBtn) {
    clearBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to completely clear the level?")) {
            runUndoableAction(() => {
                objects = [];
                selectedObjects = [];
                objectClipboard = [];
                layerState = {
                    nextId: 2,
                    activeId: 1,
                    items: [
                        { id: 1, name: 'Layer 1', hidden: false, kind: 'objects' }
                    ]
                };
                birdStart = { x: 100, y: 300 };
                finishLineObj = { type: 'finishLine', x: 1200, y: 0 };
                levelConfig = {
                    scrollSpeed: 2.4,
                    gravity: 0.4,
                    floorEnabled: true,
                    antigravity: false,
                    yTrack: false,
                    gradientTopColor: '#009dff',
                    gradientBottomColor: '#c2ccff',
                    lastUsedColor: '#ff0000'
                };
                Object.keys(toolPropertyOverrides).forEach(key => delete toolPropertyOverrides[key]);
                if (editorContainer) {
                    editorContainer.style.background = `linear-gradient(to bottom, ${levelConfig.gradientTopColor}, ${levelConfig.gradientBottomColor})`;
                }
                renderLayersUI();
                draw();
            });
        }
    });
}

// Keyboard Interaction
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && imageOverlayModal && !imageOverlayModal.classList.contains('hidden')) {
        e.preventDefault();
        closeImageOverlayModal();
        return;
    }

    if (e.key === 'Escape' && isColorPicking) {
        e.preventDefault();
        setColorPickerActive(false);
        return;
    }

    // Text tool input handling
    if (textToolState === 'editing') {
        if (e.key === 'Enter') {
            e.preventDefault();
            commitTextToLasso();
            return;
        }
        if (e.key === 'Escape') {
            e.preventDefault();
            cancelTextTool();
            return;
        }
        if (e.key === 'Backspace') {
            e.preventDefault();
            textToolContent = textToolContent.slice(0, -1);
            draw();
            return;
        }
        // Accept printable characters
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            textToolContent += e.key;
            draw();
            return;
        }
        // Allow Ctrl+Z to still work
    }

    // Undo (Ctrl+Z)
    if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        performUndo();
        return;
    }

    // Copy selected objects (Ctrl+C)
    if (e.ctrlKey && !e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        if (currentTool === 'none' && selectedObjects.length > 0) {
            const copyable = selectedObjects.filter(obj => obj.type !== 'finishLine');
            if (copyable.length > 0) {
                objectClipboard = cloneObjectsForClipboard(copyable);
            }
            e.preventDefault();
        }
        return;
    }

    // Cut selected objects (Ctrl+X)
    if (e.ctrlKey && !e.shiftKey && (e.key === 'x' || e.key === 'X')) {
        if (currentTool === 'none' && selectedObjects.length > 0) {
            const copyable = selectedObjects.filter(obj => obj.type !== 'finishLine');
            if (copyable.length > 0) {
                objectClipboard = cloneObjectsForClipboard(copyable);
                runUndoableAction(() => {
                    objects = objects.filter(obj => !selectedObjects.includes(obj));
                    selectedObjects = [];
                    draw();
                });
            }
            e.preventDefault();
        }
        return;
    }

    // Paste objects (Ctrl+V)
    if (e.ctrlKey && !e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        if (objectClipboard.length > 0) {
            if (isActiveLayerObjectLocked()) {
                e.preventDefault();
                alert('Object placement is disabled on image overlay layers. Switch to a normal layer first.');
                return;
            }
            e.preventDefault();
            runUndoableAction(() => {
                const activeLayer = getActiveLayer();
                const pasted = objectClipboard.map(obj => {
                    const clone = deepClone(obj);
                    clone.x = Number((clone.x + 24).toFixed(2));
                    clone.y = Number((clone.y - 24).toFixed(2));
                    assignLayerToObject(clone, activeLayer ? activeLayer.id : 1);
                    return clone;
                });
                objects.push(...pasted);
                selectedObjects = pasted;
                draw();
            });
        }
        return;
    }

    // Duplicate selected objects (Ctrl+D)
    if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault(); // Prevent browser bookmark dialog
        if (currentTool === 'none' && selectedObjects.length > 0) {
            runUndoableAction(() => {
                const duplicates = selectedObjects
                    .filter(obj => obj.type !== 'finishLine')
                    .map(obj => ({
                        ...obj,
                        x: obj.x + 24,
                        y: obj.y - 24
                    }));
                if (duplicates.length > 0) {
                    objects.push(...duplicates);
                    selectedObjects = duplicates;
                    draw();
                }
            });
        }
        return;
    }

    // Delete selected objects
    if (e.key === 'Delete') {
        if (currentTool === 'none' && selectedObjects.length > 0) {
            runUndoableAction(() => {
                objects = objects.filter(obj => !selectedObjects.includes(obj));
                selectedObjects = [];
                draw();
            });
        }
        return;
    }

    let snapAmount = 0;
    
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
        snapAmount = 1;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
        snapAmount = -1;
    }
    
    if (snapAmount !== 0) {
        e.preventDefault();
        
        if (currentTool === 'none' && selectedObjects.length > 0) {
            runUndoableAction(() => {
                let currentAngle = selectedObjects[0].rotation || 0;
                let newAngle;
                if (snapAmount > 0) {
                    newAngle = Math.floor(currentAngle / 45) * 45 + 45;
                } else {
                    newAngle = Math.ceil(currentAngle / 45) * 45 - 45;
                }
                let angleDelta = newAngle - currentAngle;

                if (e.shiftKey) {
                    // Shift held: rotate each object individually around its own center
                    selectedObjects.forEach(obj => {
                        if (obj.type === 'finishLine') return;
                        obj.rotation = ((obj.rotation || 0) + angleDelta + 360) % 360;
                    });
                } else {
                    let cx = 0, cy = 0;
                    selectedObjects.forEach(obj => { cx += obj.x; cy += obj.y; });
                    cx /= selectedObjects.length;
                    cy /= selectedObjects.length;

                    const rad = angleDelta * Math.PI / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);

                    selectedObjects.forEach(obj => {
                        if (obj.type === 'finishLine') return;
                        let dx = obj.x - cx;
                        let dy = obj.y - cy;
                        obj.x = cx + (dx * cos - dy * sin);
                        obj.y = cy + (dx * sin + dy * cos);
                        obj.rotation = ((obj.rotation || 0) + angleDelta + 360) % 360;
                    });
                }
                draw();
            });
        } else if (currentTool !== 'none') {
            runUndoableAction(() => {
                const currentAngle = previewRotation;
                let newAngle;
                if (snapAmount > 0) {
                    newAngle = Math.floor(currentAngle / 45) * 45 + 45;
                } else {
                    newAngle = Math.ceil(currentAngle / 45) * 45 - 45;
                }
                previewRotation = (newAngle + 360) % 360;
                draw();
            });
        }
    }
});


window.addEventListener('wheel', (e) => {
    if (currentTool === 'brush' && e.ctrlKey) {
        e.preventDefault();
        // Adjust brush radius
        const delta = Math.sign(e.deltaY) * -2;
        brushRadius = Math.max(5, Math.min(500, brushRadius + delta));
        draw();
    }
}, { passive: false });

// Canvas Interaction
canvas.addEventListener('mouseenter', () => {
    isMouseOnCanvas = true;
    if (isColorPicking) canvas.style.cursor = 'crosshair';
});
canvas.addEventListener('mouseleave', () => {
    isMouseOnCanvas = false;
    hoveredOverlayLayerId = null;
    sampledPickColor = null;
    if (!isPanning) canvas.style.cursor = 'default';
    draw();
});

canvas.addEventListener('mousedown', (e) => {
    if (isFillingLasso) return;

    if (e.button === 1) { // Middle click for panning
        isPanning = true;
        startPan = { x: e.clientX - camera.x, y: e.clientY - camera.y };
        canvas.style.cursor = 'grabbing';
        return;
    }

    const rect = canvas.getBoundingClientRect();
    mouseCanvasPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // Convert screen coordinates to game world coordinates
    let gameX = (e.clientX - rect.left - camera.x) / camera.zoom;
    let gameY = (e.clientY - rect.top - camera.y) / camera.zoom;

    // Apply grid snap
    if (activeGrid && currentTool !== 'grid' && currentTool !== 'none' && currentTool !== 'lasso' && currentTool !== 'brush' && currentTool !== 'text' && currentTool !== 'imageOverlay') {
        const snapped = applyGridSnap(gameX, gameY);
        gameX = snapped.x;
        gameY = snapped.y;
    }

    if (e.button === 0) { // Left click
        if (isColorPicking) {
            const topTarget = getTopPickTargetAtPoint(gameX, gameY);
            hoveredOverlayLayerId = (topTarget && topTarget.kind === 'overlay') ? topTarget.layer.id : null;
            const picked = sampledPickColor || resolvePickColorAtPoint(gameX, gameY, mouseCanvasPos.x, mouseCanvasPos.y);

            if (picked) {
                runUndoableAction(() => {
                    applyColorToCurrentContext(picked);
                    setColorPickerActive(false);
                });
            } else {
                setColorPickerActive(false);
            }
            return;
        }

        if (currentTool === 'grid') {
            const clickedObj = getObjectAt(gameX, gameY);
            if (clickedObj && clickedObj.type !== 'finishLine' && objectConfigs[clickedObj.type]) {
                const dims = getToolDimensions(clickedObj.type);
                const gridScale = getCompensatedScaleMagnitude(clickedObj.type, clickedObj.s || 1);
                activeGrid = {
                    cx: clickedObj.x,
                    cy: clickedObj.y,
                    w: Math.max(1, dims.w * gridScale * 0.99),
                    h: Math.max(1, dims.h * gridScale * 0.99),
                    rotation: clickedObj.rotation || 0
                };
                draw();
            }
            return;
        }

        // Text tool handling
        if (currentTool === 'text') {
            if (textToolState === 'editing' && isPointOnResizeHandle(gameX, gameY, camera.zoom)) {
                // Start resizing
                isResizingText = true;
                const handle = getTextResizeHandle();
                textResizeStartDist = Math.hypot(gameX - textToolPosition.x, gameY - textToolPosition.y);
                textResizeStartSize = textToolFontSize;
                draw();
                return;
            }
            if (textToolState === 'editing' && isPointOnTextTool(gameX, gameY)) {
                // Clicking inside the body to move it
                isMovingText = true;
                textMoveStartOffset = { x: gameX - textToolPosition.x, y: gameY - textToolPosition.y };
                return;
            }
            if (textToolState === 'editing') {
                // Clicking outside the text box commits
                const bb = getTextBoundingBox();
                const margin = 20 / camera.zoom;
                const isInsideBB = gameX >= bb.x - margin && gameX <= bb.x + bb.w + margin &&
                                   gameY >= bb.y - margin && gameY <= bb.y + bb.h + margin;
                if (!isInsideBB) {
                    if (textToolContent.trim()) {
                        commitTextToLasso();
                    } else {
                        cancelTextTool();
                    }
                    return;
                }
                return;
            }
            // Place new text
            textToolState = 'editing';
            textToolPosition = { x: gameX, y: gameY };
            textToolContent = '';
            lassoPolygon = [];
            draw();
            return;
        }

        if (currentTool === 'brush') {
            if (!lassoPolygon || lassoPolygon.length === 0) {
                // To allow a fresh start if they clicked outside or want a new base
                // Actually they might just be appending.
            }
            beginUndoBatch();
            isDrawingBrush = true;
            brushDraftPoints = [{ x: gameX, y: gameY }];
            draw();
            return;
        }

        if (currentTool === 'lasso') {
            beginUndoBatch();
            isDrawingLasso = true;
            lassoDraftPoints = [{ x: gameX, y: gameY }];
            lastLassoPoint = { x: gameX, y: gameY };
            markUndoDirty();
            draw();
            return;
        }

        if (currentTool !== 'none' && objectConfigs[currentTool] && isActiveLayerObjectLocked()) {
            alert('Object placement is disabled on image overlay layers. Switch to a normal layer first.');
            return;
        }

        if (lassoPolygon.length >= 3) {
            if (currentTool !== 'none' && canPreviewLassoFillAt(gameX, gameY)) {
                beginUndoBatch();
                isFillingLasso = true;
                showFillProgress('Filling Selection', 0, 1, 0);
                fillLassoWithCurrentTool()
                    .then((result) => {
                        if (result && result.timedOut) {
                            alert(`Fill stopped after 2 minutes. ${result.placed.toLocaleString()} blocks were placed before timeout.`);
                        }
                    })
                    .catch((err) => {
                        console.error('Lasso fill failed:', err);
                        alert('Fill failed due to an internal error.');
                    })
                    .finally(() => {
                        isFillingLasso = false;
                        hideFillProgress();
                        endUndoBatch();
                        draw();
                    });
                return;
            }

            runUndoableAction(() => {
                lassoPolygon = [];
                lassoDraftPoints = [];
                isDrawingLasso = false;
                draw();
            });
            return;
        }

        if (currentTool !== 'none') {
            beginUndoBatch();
            isTiling = true;
            tileAnchor = { x: gameX, y: gameY };
            tiledLocations.clear();
            placedTilesThisDrag.clear();
            lastTileGrid = { x: 0, y: 0 };
            tiledLocations.add('0,0');
            const anchorObj = placeObjectAtWorld(gameX, gameY);
            if (anchorObj) placedTilesThisDrag.set('0,0', anchorObj);
            draw();
        } else if (currentTool === 'none') {
            const activeOverlay = getActiveOverlayData();
            if (activeOverlay) {
                beginUndoBatch();
                selectedObjects = [];
                isDraggingOverlay = true;
                overlayDragOffset = {
                    x: gameX - activeOverlay.x,
                    y: gameY - activeOverlay.y
                };
                markUndoDirty();
                draw();
                return;
            }
            beginUndoBatch();
            let clickedObj = getObjectAt(gameX, gameY);
            if (clickedObj) {
                if (!selectedObjects.includes(clickedObj)) {
                    selectedObjects = [clickedObj];
                    markUndoDirty();
                }
                isDraggingObjects = true;
                lastDrag = { x: gameX, y: gameY };
                dragStartMouse = { x: gameX, y: gameY };
                dragAnchorStart = { x: clickedObj.x, y: clickedObj.y };
                dragLastAppliedOffset = { x: 0, y: 0 };
                dragSelectionStartStates = selectedObjects.map(obj => ({
                    obj,
                    x: obj.x,
                    y: obj.y
                }));
            } else {
                selectedObjects = [];
                markUndoDirty();
                isBoxSelecting = true;
                selectionBoxStart = { x: gameX, y: gameY };
                selectionBoxEnd = { x: gameX, y: gameY };
            }
            draw();
        }
    } else if (e.button === 2) { // Right click
        if (isColorPicking) {
            setColorPickerActive(false);
            return;
        }

        if (currentTool === 'grid') {
            activeGrid = null;
            draw();
            return;
        }

        beginUndoBatch();
        const clickedObj = getObjectAt(gameX, gameY);
        const clickedObjIsGeneric = clickedObj && clickedObj.type !== 'finishLine' && objectConfigs[clickedObj.type];

        if (currentTool !== 'none' && objectConfigs[currentTool]) {
            deleteBrushTool = currentTool;
            deleteBrushScale = previewScale;
            deleteBrushRotation = previewRotation;
        } else if (clickedObjIsGeneric) {
            deleteBrushTool = clickedObj.type;
            deleteBrushScale = clickedObj.s || 1;
            deleteBrushRotation = clickedObj.rotation || 0;
        } else {
            deleteBrushTool = 'none';
            deleteBrushScale = 1;
            deleteBrushRotation = 0;
        }

        isDeleteTiling = true;
        deleteAnchor = { x: gameX, y: gameY };
        deleteCurrentPoint = { x: gameX, y: gameY };
        deleteLastPoint = { x: gameX, y: gameY };
        deleteSquareMode = !!e.altKey;
        deleteBrushRadius = getDeleteBrushRadius();
        if (deleteSquareMode) {
            deleteObjectsTouchingRect(deleteAnchor.x, deleteAnchor.y, deleteCurrentPoint.x, deleteCurrentPoint.y);
        } else {
            deleteObjectsTouchingBrush(gameX, gameY, deleteBrushRadius);
        }
        draw();
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseCanvasPos = { x: e.clientX - rect.left, y: e.clientY - rect.top };

    if (isPanning) {
        camera.x = e.clientX - startPan.x;
        camera.y = e.clientY - startPan.y;
    }
    
    // Convert screen coordinates to game world coordinates
    let gameX = (e.clientX - rect.left - camera.x) / camera.zoom;
    let gameY = (e.clientY - rect.top - camera.y) / camera.zoom;

    // Apply grid snap
    if (activeGrid && currentTool !== 'grid' && currentTool !== 'none' && currentTool !== 'lasso' && currentTool !== 'brush' && currentTool !== 'text' && currentTool !== 'imageOverlay') {
        const snapped = applyGridSnap(gameX, gameY);
        gameX = snapped.x;
        gameY = snapped.y;
    }

    if (isResizingText) {
        const dist = Math.hypot(gameX - textToolPosition.x, gameY - textToolPosition.y);
        const ratio = dist / (textResizeStartDist || 1);
        textToolFontSize = clamp(textResizeStartSize * ratio, TEXT_MIN_FONT_SIZE, TEXT_MAX_FONT_SIZE);
        draw();
    } else if (isMovingText) {
        textToolPosition.x = gameX - textMoveStartOffset.x;
        textToolPosition.y = gameY - textMoveStartOffset.y;
        draw();
    } else if (isDrawingBrush) {
        const nextPoint = { x: gameX, y: gameY };
        const lastPt = brushDraftPoints[brushDraftPoints.length - 1];
        if (distanceBetweenPoints(lastPt, nextPoint) >= 3) {
            brushDraftPoints.push(nextPoint);
        }
        draw();
    } else if (isDrawingLasso) {
        const nextPoint = { x: gameX, y: gameY };
        if (!lastLassoPoint || distanceBetweenPoints(lastLassoPoint, nextPoint) >= 6) {
            lassoDraftPoints.push(nextPoint);
            lastLassoPoint = nextPoint;
            markUndoDirty();
        }
    } else if (isTiling) {
        const { dims, scale, rad } = getTilingMetrics(currentTool);
        const cellW = dims.w * scale * 0.99;
        const cellH = dims.h * scale * 0.99;
        
        // Unrotated offset from anchor
        const dx = gameX - tileAnchor.x;
        const dy = gameY - tileAnchor.y;
        
        // Rotate dx, dy to local axes of the blocks
        const localX = dx * Math.cos(-rad) - dy * Math.sin(-rad);
        const localY = dx * Math.sin(-rad) + dy * Math.cos(-rad);
        
        const gridX = Math.round(localX / cellW);
        const gridY = Math.round(localY / cellH);
        const squareMode = !!e.altKey;

        if (squareMode) {
            updateSquarePlacement(gridX, gridY, cellW, cellH, rad);
        } else {
            const gridPath = getGridCellsOnLine(lastTileGrid.x, lastTileGrid.y, gridX, gridY);
            gridPath.forEach(cell => {
                placeTileAtGrid(cell.x, cell.y, cellW, cellH, rad);
            });
        }

        lastTileGrid = { x: gridX, y: gridY };
    } else if (isDeleteTiling) {
        deleteCurrentPoint = { x: gameX, y: gameY };
        deleteSquareMode = !!e.altKey;
        deleteBrushRadius = getDeleteBrushRadius();

        if (deleteSquareMode) {
            deleteObjectsTouchingRect(deleteAnchor.x, deleteAnchor.y, deleteCurrentPoint.x, deleteCurrentPoint.y);
        } else {
            deleteObjectsTouchingStroke(deleteLastPoint.x, deleteLastPoint.y, deleteCurrentPoint.x, deleteCurrentPoint.y, deleteBrushRadius);
            deleteLastPoint = { ...deleteCurrentPoint };
        }
    } else if (isDraggingOverlay) {
        const activeOverlay = getActiveOverlayData();
        if (activeOverlay) {
            activeOverlay.x = Number((gameX - overlayDragOffset.x).toFixed(2));
            activeOverlay.y = Number((gameY - overlayDragOffset.y).toFixed(2));
            markUndoDirty();
        }
    } else if (isDraggingObjects) {
        let dx = gameX - dragStartMouse.x;
        let dy = gameY - dragStartMouse.y;

        if (activeGrid && currentTool === 'none') {
            const snappedAnchor = applyGridSnap(dragAnchorStart.x + dx, dragAnchorStart.y + dy);
            dx = snappedAnchor.x - dragAnchorStart.x;
            dy = snappedAnchor.y - dragAnchorStart.y;
        }

        if (dx !== dragLastAppliedOffset.x || dy !== dragLastAppliedOffset.y) {
            markUndoDirty();
            dragLastAppliedOffset = { x: dx, y: dy };
        }

        for (const startState of dragSelectionStartStates) {
            const obj = startState.obj;
            obj.x = startState.x + dx;
            if (obj.type !== 'finishLine') {
                obj.y = startState.y + dy;
            }
        }

        lastDrag = { x: gameX, y: gameY };
    } else if (isBoxSelecting) {
        selectionBoxEnd = { x: gameX, y: gameY };
        const minX = Math.min(selectionBoxStart.x, selectionBoxEnd.x);
        const maxX = Math.max(selectionBoxStart.x, selectionBoxEnd.x);
        const minY = Math.min(selectionBoxStart.y, selectionBoxEnd.y);
        const maxY = Math.max(selectionBoxStart.y, selectionBoxEnd.y);
        
        selectedObjects = objects.filter(obj => isObjectEditableInCurrentLayer(obj) && obj.x >= minX && obj.x <= maxX && obj.y >= minY && obj.y <= maxY);
        markUndoDirty();
    }

    // Always update preview coordinates if mouse is on canvas
    previewX = gameX;
    previewY = gameY;

    if (isColorPicking) {
        const topTarget = getTopPickTargetAtPoint(gameX, gameY);
        hoveredOverlayLayerId = (topTarget && topTarget.kind === 'overlay') ? topTarget.layer.id : null;
        sampledPickColor = resolvePickColorAtPoint(gameX, gameY, mouseCanvasPos.x, mouseCanvasPos.y);
    } else {
        hoveredOverlayLayerId = null;
        sampledPickColor = null;
    }
    
    draw();
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 1) {
        isPanning = false;
        canvas.style.cursor = isColorPicking ? 'crosshair' : 'default';
    }
    if (e.button === 0) {
        if (isResizingText) {
            isResizingText = false;
            draw();
        }
        if (isMovingText) {
            isMovingText = false;
        }
        if (isDrawingBrush) {
            isDrawingBrush = false;
            combineBrushWithLasso();
            draw();
        }
        if (isDrawingLasso) {
            isDrawingLasso = false;
            if (lassoDraftPoints.length >= 2) {
                lassoPolygon = deepClone(lassoDraftPoints);
                markUndoDirty();
            }
            lassoDraftPoints = [];
            lastLassoPoint = null;
        }

        if (isTiling) {
            isTiling = false;
            placedTilesThisDrag.clear();
        }
        if (isDraggingObjects) {
            selectedObjects.forEach(obj => {
                obj.x = Number(obj.x.toFixed(2));
                obj.y = Number(obj.y.toFixed(2));
            });
        }
        if (isDraggingOverlay) {
            isDraggingOverlay = false;
        }
        isDraggingObjects = false;
        dragSelectionStartStates = [];
        isBoxSelecting = false;
        endUndoBatch();
        draw();
    } else if (e.button === 2) {
        if (isDeleteTiling) {
            isDeleteTiling = false;
            deleteSquareMode = false;
            deleteBrushTool = 'none';
            deleteBrushScale = 1;
            deleteBrushRotation = 0;
            deleteBrushRadius = 20;
            endUndoBatch();
            draw();
        }
    }
});

window.addEventListener('mouseup', () => {
    if (isDrawingLasso || isTiling || isDraggingObjects || isBoxSelecting || isDraggingOverlay) {
        if (isDrawingLasso) {
            isDrawingLasso = false;
            if (lassoDraftPoints.length >= 2) {
                lassoPolygon = deepClone(lassoDraftPoints);
                markUndoDirty();
            }
            lassoDraftPoints = [];
            lastLassoPoint = null;
        }
        if (isDrawingBrush) {
            isDrawingBrush = false;
            combineBrushWithLasso();
        }
        isTiling = false;
        placedTilesThisDrag.clear();
        isDraggingObjects = false;
        isDraggingOverlay = false;
        dragSelectionStartStates = [];
        isBoxSelecting = false;
        endUndoBatch();
        draw();
    }

    if (isDeleteTiling) {
        isDeleteTiling = false;
        deleteSquareMode = false;
        deleteBrushTool = 'none';
        deleteBrushScale = 1;
        deleteBrushRotation = 0;
        deleteBrushRadius = 20;
        endUndoBatch();
        draw();
    }
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    // Alt + Scroll to scale the preview / selected objects
    if (e.altKey) {
        const scaleSpeed = 0.1;
        const factor = e.deltaY > 0 ? (1 - scaleSpeed) : (1 + scaleSpeed);

        const activeOverlay = getActiveOverlayData();
        if (activeOverlay && currentTool === 'none') {
            runUndoableAction(() => {
                const nextScale = Math.max(OVERLAY_MIN_SCALE, Math.min(OVERLAY_MAX_SCALE, activeOverlay.scale * factor));
                activeOverlay.scale = Number(nextScale.toFixed(3));
                draw();
            });
            return;
        }

        if (currentTool === 'none' && selectedObjects.length > 0) {
            runUndoableAction(() => {
                if (e.shiftKey) {
                    // Shift held: scale each object individually around its own center
                    selectedObjects.forEach(obj => {
                        if (obj.type === 'finishLine') return;
                        const collisonEnabled = obj.collison !== false;
                        const currentScale = obj.s !== undefined ? obj.s : (collisonEnabled ? 1 : -1);
                        const nextMagnitude = Math.max(0.005, Math.abs(currentScale) * factor);
                        obj.s = getSignedScaleFromCollison(nextMagnitude, collisonEnabled);
                        obj.s = Number(obj.s.toFixed(3));
                    });
                } else {
                    let cx = 0;
                    let cy = 0;
                    let count = 0;

                    selectedObjects.forEach(obj => {
                        if (obj.type === 'finishLine') return;
                        cx += obj.x;
                        cy += obj.y;
                        count++;
                    });

                    if (count === 0) {
                        draw();
                        return;
                    }

                    cx /= count;
                    cy /= count;

                    selectedObjects.forEach(obj => {
                        if (obj.type === 'finishLine') return;

                        const dx = obj.x - cx;
                        const dy = obj.y - cy;
                        obj.x = Number((cx + dx * factor).toFixed(2));
                        obj.y = Number((cy + dy * factor).toFixed(2));

                        const collisonEnabled = obj.collison !== false;
                        const currentScale = obj.s !== undefined ? obj.s : (collisonEnabled ? 1 : -1);
                        const nextMagnitude = Math.max(0.005, Math.abs(currentScale) * factor);
                        obj.s = getSignedScaleFromCollison(nextMagnitude, collisonEnabled);
                        obj.s = Number(obj.s.toFixed(3));
                    });
                }
                draw();
            });
        } else if (currentTool !== 'none') {
            runUndoableAction(() => {
                const collisonEnabled = getToolOverride(currentTool, 'collison') !== false;
                const nextMagnitude = Math.max(0.005, Math.abs(previewScale || 1) * factor);
                previewScale = getSignedScaleFromCollison(nextMagnitude, collisonEnabled);
                previewScale = Number(previewScale.toFixed(3));
                draw();
            });
        }
        return;
    }
    
    // Ctrl + Scroll to carefully rotate the preview
    if (e.ctrlKey) {
        const rotationSpeed = 5; 
        const amount = e.deltaY > 0 ? rotationSpeed : -rotationSpeed;

        const activeOverlay = getActiveOverlayData();
        if (activeOverlay && currentTool === 'none') {
            runUndoableAction(() => {
                activeOverlay.rotation = (activeOverlay.rotation + amount + 360) % 360;
                activeOverlay.rotation = Number(activeOverlay.rotation.toFixed(2));
                draw();
            });
            return;
        }
        
        if (currentTool === 'none' && selectedObjects.length > 0) {
            runUndoableAction(() => {
                if (e.shiftKey) {
                    // Shift held: rotate each object individually around its own center
                    selectedObjects.forEach(obj => {
                        if (obj.type === 'finishLine') return;
                        obj.rotation = ((obj.rotation || 0) + amount + 360) % 360;
                    });
                } else {
                    let cx = 0, cy = 0;
                    selectedObjects.forEach(obj => { cx += obj.x; cy += obj.y; });
                    cx /= selectedObjects.length;
                    cy /= selectedObjects.length;

                    const rad = amount * Math.PI / 180;
                    const cos = Math.cos(rad);
                    const sin = Math.sin(rad);

                    selectedObjects.forEach(obj => {
                        if (obj.type === 'finishLine') return;
                        let dx = obj.x - cx;
                        let dy = obj.y - cy;
                        obj.x = cx + (dx * cos - dy * sin);
                        obj.y = cy + (dx * sin + dy * cos);
                        obj.rotation = ((obj.rotation || 0) + amount + 360) % 360;
                    });
                }
                draw();
            });
        } else if (currentTool !== 'none') {
            runUndoableAction(() => {
                previewRotation = (previewRotation + amount + 360) % 360;
                draw();
            });
        }
        return;
    }

    // Zoom in/out to mouse position
    const zoomIntensity = 0.1;
    const previousZoom = camera.zoom;
    
    if (e.deltaY < 0) {
        camera.zoom *= (1 + zoomIntensity);
    } else {
        camera.zoom /= (1 + zoomIntensity);
    }
    
    // Clamp zoom
    camera.zoom = Math.max(0.1, Math.min(camera.zoom, 10));

    // Adjust camera pan so zoom is centered on mouse
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    camera.x = mouseX - (mouseX - camera.x) * (camera.zoom / previousZoom);
    camera.y = mouseY - (mouseY - camera.y) * (camera.zoom / previousZoom);

    draw();
}, { passive: false });

// Prevent context menu on right click
canvas.addEventListener('contextmenu', e => e.preventDefault());

function getObjectAt(x, y) {
    if (Math.abs(finishLineObj.x - x) < 30) {
        return finishLineObj;
    }
    const index = getObjectIndexAt(x, y);
    return index !== -1 ? objects[index] : null;
}

function getObjectIndexAt(x, y) {
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (!isObjectEditableInCurrentLayer(obj)) continue;
        const scale = Math.abs(obj.s || 1);
        const hitRadius = 20 * scale;
        if (Math.abs(obj.x - x) < hitRadius && Math.abs(obj.y - y) < hitRadius) {
            return i;
        }
    }
    return -1;
}

// Drawing
function draw() {
    try {
        const drawStartMs = performance.now();
        updateObjectCountDisplay();
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, width, height);

        ctx.save();

        // Apply Camera
        ctx.translate(camera.x, camera.y);
        ctx.scale(camera.zoom, camera.zoom);

    const viewPad = 140 / Math.max(0.2, camera.zoom);
    const viewMinX = (-camera.x / camera.zoom) - viewPad;
    const viewMaxX = ((-camera.x + width) / camera.zoom) + viewPad;
    const viewMinY = (-camera.y / camera.zoom) - viewPad;
    const viewMaxY = ((-camera.y + height) / camera.zoom) + viewPad;
    const selectedSet = new Set(selectedObjects);
    const nowMs = performance.now();
    const useAdaptiveFastColorable = objects.length >= ADAPTIVE_FAST_COLORABLE_OBJECT_THRESHOLD && nowMs < adaptiveFastColorableUntil;
    const useFastColorableRender = objects.length >= FAST_COLORABLE_RENDER_THRESHOLD || useAdaptiveFastColorable;

    const isObjectLikelyVisible = (obj, dims, visualScale) => {
        const halfW = (dims.w * visualScale) / 2;
        const halfH = (dims.h * visualScale) / 2;
        const radius = Math.sqrt((halfW * halfW) + (halfH * halfH));
        return !(obj.x + radius < viewMinX || obj.x - radius > viewMaxX || obj.y + radius < viewMinY || obj.y - radius > viewMaxY);
    };

    // Draw objects and overlays by layer order (bottom to top).
    const sortedObjects = getSortedObjectsForDraw();
    const objectsByLayer = buildObjectsByLayer(sortedObjects);

    const drawObjectSprite = (obj) => {
        if (isLayerHiddenForObject(obj)) return;
        const config = objectConfigs[obj.type];
        if (!config) return;

        const dims = getRenderDimensions(obj.type);
        const visualScale = getCompensatedScaleMagnitude(obj.type, obj.s || 1);
        if (!isObjectLikelyVisible(obj, dims, visualScale)) return;

        const isDimmed = !isObjectEditableInCurrentLayer(obj);
        ctx.save();
        if (isDimmed) {
            ctx.globalAlpha = 0.72;
        }
        ctx.translate(obj.x, obj.y);
        ctx.rotate(obj.rotation * Math.PI / 180);
        if (obj.s !== undefined && obj.s !== 1) {
            const compensatedScale = getCompensatedRenderScale(obj.type, obj.s);
            ctx.scale(compensatedScale, compensatedScale);
        }

        const img = objectImages[obj.type];
        const w = dims.w;
        const h = dims.h;

        if (useFastColorableRender && config.colorable && FAST_COLORABLE_TYPES.has(obj.type)) {
            ctx.fillStyle = obj.color || '#ffffff';
            ctx.fillRect(-w / 2, -h / 2, w, h);
        } else if (img && img.complete) {
            if (config.colorable) {
                drawTintedImage(ctx, img, obj.color || '#ffffff', -w / 2, -h / 2, w, h);
            } else {
                ctx.drawImage(img, -w / 2, -h / 2, w, h);
            }
        } else {
            ctx.fillStyle = config.fallbackColor || '#ff8888';
            ctx.fillRect(-w / 2, -h / 2, w, h);
        }

        if (selectedSet.has(obj)) {
            ctx.strokeStyle = config.highlight || '#00ffcc';
            const zoomComp = Math.max(1, camera.zoom);
            const outlinePad = 1.65 / zoomComp;
            ctx.lineWidth = 1.9 / zoomComp;
            ctx.strokeRect(-w / 2 - outlinePad, -h / 2 - outlinePad, w + outlinePad * 2, h + outlinePad * 2);
        }
        ctx.restore();

        if (objectHasMovementEnabled(obj) && selectedSet.has(obj)) {
            const moveAngle = Number(obj.mA) || 0;
            const moveSpeed = Math.abs(Number(obj.mS) || 0);
            const arrowLen = 26 + Math.min(42, moveSpeed * 3.5);
            const endX = obj.x + Math.cos(moveAngle) * arrowLen;
            const endY = obj.y + Math.sin(moveAngle) * arrowLen;
            const headLen = 8;
            const leftA = moveAngle + Math.PI * 0.82;
            const rightA = moveAngle - Math.PI * 0.82;

            ctx.save();
            if (isDimmed) ctx.globalAlpha = 0.72;
            ctx.strokeStyle = '#ffd166';
            ctx.fillStyle = '#ffd166';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath();
            ctx.moveTo(obj.x, obj.y);
            ctx.lineTo(endX, endY);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX + Math.cos(leftA) * headLen, endY + Math.sin(leftA) * headLen);
            ctx.lineTo(endX + Math.cos(rightA) * headLen, endY + Math.sin(rightA) * headLen);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    };

    const drawOverlayLayerImage = (layer) => {
        if (!isOverlayLayer(layer) || layer.hidden) return;
        const overlay = layer.overlay;
        if (!overlay || !overlay.src) return;

        const img = getOverlayImageForLayer(layer);
        const overlayScale = Math.max(OVERLAY_MIN_SCALE, Number(overlay.scale) || 1);
        const overlayRotation = Number(overlay.rotation) || 0;
        const baseW = (img && img.naturalWidth) ? img.naturalWidth : 300;
        const baseH = (img && img.naturalHeight) ? img.naturalHeight : 200;
        const drawW = baseW * overlayScale;
        const drawH = baseH * overlayScale;
        const isActiveOverlay = layer.id === layerState.activeId;
        const isPickerHoveredOverlay = isColorPicking && hoveredOverlayLayerId === layer.id;

        ctx.save();
        ctx.translate(overlay.x || 0, overlay.y || 0);
        ctx.rotate(overlayRotation * Math.PI / 180);
        ctx.globalAlpha = isPickerHoveredOverlay ? 1 : OVERLAY_ALPHA;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
            ctx.fillStyle = '#73d2ff';
            ctx.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
            ctx.strokeStyle = '#1e6b8f';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.strokeRect(-drawW / 2, -drawH / 2, drawW, drawH);
        }
        ctx.restore();

        if (isActiveOverlay) {
            ctx.save();
            ctx.translate(overlay.x || 0, overlay.y || 0);
            ctx.rotate(overlayRotation * Math.PI / 180);
            ctx.strokeStyle = '#73d2ff';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.setLineDash([8 / camera.zoom, 6 / camera.zoom]);
            ctx.strokeRect(-drawW / 2, -drawH / 2, drawW, drawH);
            ctx.setLineDash([]);
            ctx.restore();

            ctx.save();
            ctx.fillStyle = 'rgba(115, 210, 255, 0.9)';
            ctx.font = `${12 / camera.zoom}px Arial, sans-serif`;
            ctx.textBaseline = 'bottom';
            ctx.fillText('Overlay: drag to move, Alt+wheel to scale, Ctrl+wheel to rotate', (overlay.x || 0) - drawW / 2, (overlay.y || 0) - drawH / 2 - (8 / camera.zoom));
            ctx.restore();
        }

        if (overlayConvertState.isOpen && overlayConvertState.layerId === layer.id && overlayConvertState.previewBlocks.length > 0) {
            ctx.save();
            const dims = getToolDimensions(OVERLAY_CONVERT_TARGET_TOOL);
            ctx.globalAlpha = 0.62;
            for (const block of overlayConvertState.previewBlocks) {
                const w = dims.w * block.scale;
                const h = dims.h * block.scale;
                ctx.fillStyle = block.color;
                ctx.fillRect(block.x - (w / 2), block.y - (h / 2), w, h);
            }
            ctx.restore();
        }
    };

    for (let i = layerState.items.length - 1; i >= 0; i--) {
        const layer = layerState.items[i];
        if (layer.hidden) continue;
        drawOverlayLayerImage(layer);
        const layerObjects = objectsByLayer.get(layer.id) || [];
        layerObjects.forEach(obj => drawObjectSprite(obj));
    }

    for (const obj of sortedObjects) {
        if (!getLayerById(obj.layerId)) {
            drawObjectSprite(obj);
        }
    }

    // Draw Preview Overlay (Ghosts)
    if (isMouseOnCanvas && currentTool !== 'none' && objectConfigs[currentTool]) {
        const config = objectConfigs[currentTool];
        ctx.save();
        ctx.globalAlpha = 0.5;

        ctx.translate(previewX, previewY);
        ctx.rotate(previewRotation * Math.PI / 180);
        if (previewScale !== 1) {
            const compensatedPreviewScale = getCompensatedRenderScale(currentTool, previewScale);
            ctx.scale(compensatedPreviewScale, compensatedPreviewScale);
        }

        const img = objectImages[currentTool];
        const dims = getRenderDimensions(currentTool);
        const w = dims.w;
        const h = dims.h;

        if (img && img.complete) {

            if (config.colorable) {
                drawTintedImage(ctx, img, levelConfig.lastUsedColor, -w / 2, -h / 2, w, h);
            } else {
                ctx.drawImage(img, -w / 2, -h / 2, w, h);
            }
        } else {
            ctx.fillStyle = config.fallbackColor || '#ff8888';
            ctx.fillRect(-w / 2, -h / 2, w, h);
        }
        ctx.restore();
    }

    // Draw Box Selection
    if (isBoxSelecting) {
        ctx.fillStyle = 'rgba(0, 255, 204, 0.2)';
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 1 / camera.zoom;
        const bx = selectionBoxStart.x;
        const by = selectionBoxStart.y;
        const bw = selectionBoxEnd.x - selectionBoxStart.x;
        const bh = selectionBoxEnd.y - selectionBoxStart.y;
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
    }

    // Draw Text Tool
    if (textToolState === 'editing') {
        ctx.save();
        const bb = getTextBoundingBox();
        const displayText = textToolContent || '';

        // Draw text
        if (displayText) {
            ctx.font = `bold ${textToolFontSize}px ${textToolFont}`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.textBaseline = 'top';
            ctx.fillText(displayText, bb.x, bb.y);
        }

        // Draw bounding box
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
        ctx.strokeRect(bb.x - 4, bb.y - 4, bb.w + 8, bb.h + 8);
        ctx.setLineDash([]);

        // Blinking cursor
        const cursorVisible = Math.floor(Date.now() / 530) % 2 === 0;
        if (cursorVisible) {
            const cursorX = displayText ? bb.x + bb.w + 2 : bb.x;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath();
            ctx.moveTo(cursorX, bb.y);
            ctx.lineTo(cursorX, bb.y + bb.h);
            ctx.stroke();
        }

        // Draw resize handle (circle at bottom-right corner)
        if (displayText) {
            const handle = getTextResizeHandle();
            const handleR = TEXT_HANDLE_RADIUS / camera.zoom;
            ctx.fillStyle = '#ffd166';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2 / camera.zoom;
            ctx.beginPath();
            ctx.arc(handle.x, handle.y, handleR, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Instructions text
        ctx.font = `${12 / camera.zoom}px Arial, sans-serif`;
        ctx.fillStyle = 'rgba(255, 209, 102, 0.8)';
        ctx.textBaseline = 'top';
        ctx.fillText('Type text, Enter to confirm, Esc to cancel', bb.x, bb.y + bb.h + 12 / camera.zoom);

        ctx.restore();

        // Schedule redraw for cursor blink
        if (!textBlinkTimer) {
            textBlinkTimer = setInterval(() => {
                if (textToolState === 'editing') draw();
                else { clearInterval(textBlinkTimer); textBlinkTimer = null; }
            }, 530);
        }
    }

    // Draw Brush Preview or Stroke
    if (currentTool === 'brush' && isMouseOnCanvas && !isDrawingBrush && textToolState === 'idle') {
        const cursorWorldX = previewX;
        const cursorWorldY = previewY;
        
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.5)';
        ctx.fillStyle = 'rgba(255, 209, 102, 0.2)';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.beginPath();
        ctx.arc(cursorWorldX, cursorWorldY, brushRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    if (isDrawingBrush && brushDraftPoints.length > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 209, 102, 0.5)';
        ctx.fillStyle = 'rgba(255, 209, 102, 0.2)';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = brushRadius * 2;
        
        ctx.beginPath();
        ctx.moveTo(brushDraftPoints[0].x, brushDraftPoints[0].y);
        for (let i = 1; i < brushDraftPoints.length; i++) {
            ctx.lineTo(brushDraftPoints[i].x, brushDraftPoints[i].y);
        }
        if (brushDraftPoints.length === 1) {
            ctx.lineTo(brushDraftPoints[0].x + 0.1, brushDraftPoints[0].y);
        }
        ctx.stroke();
        ctx.restore();
    }

    // Draw Active Grid
    if (activeGrid) {
        ctx.save();
        ctx.translate(activeGrid.cx, activeGrid.cy);
        ctx.rotate(activeGrid.rotation * Math.PI / 180);
        
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
        ctx.lineWidth = 1.5 / camera.zoom;
        ctx.setLineDash([6 / camera.zoom, 4 / camera.zoom]);
        
        const viewStartX = -camera.x / camera.zoom;
        const viewEndX = (-camera.x + canvas.width) / camera.zoom;
        const viewStartY = -camera.y / camera.zoom;
        const viewEndY = (-camera.y + canvas.height) / camera.zoom;
        
        const rad = -activeGrid.rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        
        const corners = [
            { x: viewStartX, y: viewStartY },
            { x: viewEndX, y: viewStartY },
            { x: viewEndX, y: viewEndY },
            { x: viewStartX, y: viewEndY }
        ];
        
        let minLX = Infinity, maxLX = -Infinity, minLY = Infinity, maxLY = -Infinity;
        corners.forEach(c => {
            const dx = c.x - activeGrid.cx;
            const dy = c.y - activeGrid.cy;
            const lx = dx * cos - dy * sin;
            const ly = dx * sin + dy * cos;
            if (lx < minLX) minLX = lx;
            if (lx > maxLX) maxLX = lx;
            if (ly < minLY) minLY = ly;
            if (ly > maxLY) maxLY = ly;
        });

        // Snap visible bounds to grid intervals
        minLX = Math.floor(minLX / activeGrid.w) * activeGrid.w;
        maxLX = Math.ceil(maxLX / activeGrid.w) * activeGrid.w;
        minLY = Math.floor(minLY / activeGrid.h) * activeGrid.h;
        maxLY = Math.ceil(maxLY / activeGrid.h) * activeGrid.h;

        // Hard limit on line count
        if (maxLX - minLX > 1000 * activeGrid.w) maxLX = minLX + 1000 * activeGrid.w;
        if (maxLY - minLY > 1000 * activeGrid.h) maxLY = minLY + 1000 * activeGrid.h;

        ctx.beginPath();
        for (let x = minLX; x <= maxLX; x += activeGrid.w) {
            ctx.moveTo(x, minLY);
            ctx.lineTo(x, maxLY);
        }
        for (let y = minLY; y <= maxLY; y += activeGrid.h) {
            ctx.moveTo(minLX, y);
            ctx.lineTo(maxLX, y);
        }
        ctx.stroke();
        ctx.restore();
    }

    const activeLassoPoints = isDrawingLasso ? lassoDraftPoints : lassoPolygon;
    if (activeLassoPoints.length >= 2) {
        ctx.save();
        ctx.strokeStyle = '#ffd166';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.setLineDash([8 / camera.zoom, 6 / camera.zoom]);
        ctx.beginPath();
        ctx.moveTo(activeLassoPoints[0].x, activeLassoPoints[0].y);
        for (let i = 1; i < activeLassoPoints.length; i++) {
            ctx.lineTo(activeLassoPoints[i].x, activeLassoPoints[i].y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
    }

    if (canPreviewLassoFillAt(previewX, previewY)) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(lassoPolygon[0].x, lassoPolygon[0].y);
        for (let i = 1; i < lassoPolygon.length; i++) {
            ctx.lineTo(lassoPolygon[i].x, lassoPolygon[i].y);
        }
        ctx.closePath();
        ctx.clip();

        ctx.strokeStyle = 'rgba(0, 255, 255, 0.45)';
        ctx.lineWidth = 2 / camera.zoom;
        let spacing = 14 / camera.zoom;
        const minX = Math.min(...lassoPolygon.map(point => point.x)) - 100;
        const maxX = Math.max(...lassoPolygon.map(point => point.x)) + 100;
        const minY = Math.min(...lassoPolygon.map(point => point.y)) - 100;
        const maxY = Math.max(...lassoPolygon.map(point => point.y)) + 100;
        const spanY = (maxY - minY);
        const hatchStartX = minX - spanY;
        const hatchEndX = maxX + spanY;

        const maxLines = 520;
        const estimatedLines = Math.max(1, (hatchEndX - hatchStartX) / Math.max(0.001, spacing));
        if (estimatedLines > maxLines) {
            spacing = (hatchEndX - hatchStartX) / maxLines;
        }

        ctx.beginPath();
        for (let x = hatchStartX; x <= hatchEndX; x += spacing) {
            ctx.moveTo(x, minY);
            ctx.lineTo(x + spanY, maxY);
        }
        ctx.stroke();

        ctx.restore();
    }

    if (isDeleteTiling) {
        ctx.save();
        ctx.strokeStyle = '#ff4444';
        ctx.fillStyle = 'rgba(255, 68, 68, 0.15)';
        ctx.lineWidth = 2 / camera.zoom;
        ctx.setLineDash([8 / camera.zoom, 6 / camera.zoom]);

        if (deleteSquareMode) {
            const minX = Math.min(deleteAnchor.x, deleteCurrentPoint.x);
            const minY = Math.min(deleteAnchor.y, deleteCurrentPoint.y);
            const rectW = Math.abs(deleteCurrentPoint.x - deleteAnchor.x);
            const rectH = Math.abs(deleteCurrentPoint.y - deleteAnchor.y);
            ctx.fillRect(minX, minY, rectW, rectH);
            ctx.strokeRect(minX, minY, rectW, rectH);
        } else {
            ctx.beginPath();
            ctx.arc(deleteCurrentPoint.x, deleteCurrentPoint.y, deleteBrushRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
    }
    
    // Draw Finish Line
    ctx.save();
    ctx.translate(finishLineObj.x, 0);
    const sqSize = 30;
    // Visible Y range
    const startY = Math.floor((-camera.y) / camera.zoom / sqSize) - 1;
    const endY = Math.floor((-camera.y + height) / camera.zoom / sqSize) + 5;

    if (selectedObjects.includes(finishLineObj)) {
        ctx.fillStyle = 'rgba(0, 255, 204, 0.3)';
        ctx.fillRect(-sqSize, startY * sqSize, sqSize * 2, (endY - startY) * sqSize);
    }

    for (let i = startY; i <= endY; i++) {
        ctx.fillStyle = (i % 2 === 0) ? '#000000' : '#ffffff';
        ctx.fillRect(-sqSize, i * sqSize, sqSize, sqSize);
        ctx.fillStyle = (i % 2 === 0) ? '#ffffff' : '#000000';
        ctx.fillRect(0, i * sqSize, sqSize, sqSize);
    }
    ctx.restore();

    // Draw Guides
    ctx.save();
    const viewStartX = -camera.x / camera.zoom;
    const viewEndX = (-camera.x + width) / camera.zoom;
    ctx.lineWidth = 2 / camera.zoom;
    ctx.setLineDash([10 / camera.zoom, 10 / camera.zoom]); // Dashed lines for guides

    // Calculate reference coordinates based on a spike width of 75.92 and half width of 37.96.
    // -28 (top) + 37.96 = 9.96
    // 481 (middle) - 37.96 = 443.04
    // 700 (bottom) - 37.96 = 662.04

    if (!levelConfig.yTrack) {
        ctx.strokeStyle = '#ff0000';
        
        // Ceiling death barrier
        ctx.beginPath();
        ctx.moveTo(viewStartX, 9.96);
        ctx.lineTo(viewEndX, 9.96);
        ctx.stroke();

        // Bottom death barrier
        ctx.beginPath();
        ctx.moveTo(viewStartX, 662.04);
        ctx.lineTo(viewEndX, 662.04);
        ctx.stroke();
    }

    if (levelConfig.floorEnabled) {
        ctx.strokeStyle = '#00ff00';
        
        // Floor line
        ctx.beginPath();
        ctx.moveTo(viewStartX, 443.04);
        ctx.lineTo(viewEndX, 443.04);
        ctx.stroke();
    }
    ctx.restore();

    // Draw bird (Goose) last so it always appears above everything else.
    ctx.save();
    const GOOSE_OFFSET_X = 18;
    const GOOSE_OFFSET_Y = -12;
    ctx.translate(birdStart.x + GOOSE_OFFSET_X, birdStart.y + GOOSE_OFFSET_Y);
    ctx.scale(-1, 1);

    if (gooseImg.complete && gooseImg.naturalWidth !== 0) {
        ctx.drawImage(gooseImg, -GOOSE_WIDTH / 2, -GOOSE_HEIGHT / 2, GOOSE_WIDTH, GOOSE_HEIGHT);
    } else {
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🦆', 0, 0);
    }
    ctx.restore();

    ctx.restore(); // Restore Camera

    if (isColorPicking && isMouseOnCanvas) {
        const topTarget = getTopPickTargetAtPoint(previewX, previewY);
        hoveredOverlayLayerId = (topTarget && topTarget.kind === 'overlay') ? topTarget.layer.id : null;
        const liveSample = resolvePickColorAtPoint(previewX, previewY, mouseCanvasPos.x, mouseCanvasPos.y);
        if (liveSample) sampledPickColor = liveSample;

        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mouseCanvasPos.x, mouseCanvasPos.y, 8, 0, Math.PI * 2);
        ctx.stroke();

        const swatchColor = sampledPickColor || levelConfig.lastUsedColor;
        ctx.fillStyle = swatchColor;
        ctx.fillRect(mouseCanvasPos.x + 12, mouseCanvasPos.y + 12, 22, 22);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 1;
        ctx.strokeRect(mouseCanvasPos.x + 12, mouseCanvasPos.y + 12, 22, 22);
        ctx.restore();
    }

    if (objects.length >= ADAPTIVE_FAST_COLORABLE_OBJECT_THRESHOLD) {
        const drawDurationMs = performance.now() - drawStartMs;
        if (drawDurationMs > ADAPTIVE_FAST_COLORABLE_FRAME_BUDGET_MS) {
            adaptiveFastColorableUntil = performance.now() + ADAPTIVE_FAST_COLORABLE_HOLD_MS;
        }
    }
    } catch (e) {
        console.error("DRAW ERROR:", e);
        if (!window.hasAlertedDraw) { alert("Draw Error: " + e.message); window.hasAlertedDraw = true; }
        ctx.restore(); // Attempt emergency restore
    }

    if (typeof updatePropertiesPanel === 'function') updatePropertiesPanel();
}

// Export modal logic
const exportModal = document.getElementById('export-modal');
const jsonOutput = document.getElementById('json-output');
const closeModal = document.getElementById('close-modal');

closeModal.addEventListener('click', () => {
    exportModal.classList.add('hidden');
});

// Settings Modal Logic
const settingsModal = document.getElementById('settings-modal');
const closeSettingsModal = document.getElementById('close-settings-modal');
const settingsBtn = document.getElementById('settings-btn');

settingsBtn.addEventListener('click', () => {
    document.getElementById('set-scrollSpeed').value = levelConfig.scrollSpeed;
    document.getElementById('set-gravity').value = levelConfig.gravity;
    document.getElementById('set-floorEnabled').checked = levelConfig.floorEnabled;
    document.getElementById('set-antigravity').checked = levelConfig.antigravity;
    document.getElementById('set-yTrack').checked = levelConfig.yTrack;
    document.getElementById('set-gradientTop').value = levelConfig.gradientTopColor;
    document.getElementById('set-gradientBottom').value = levelConfig.gradientBottomColor;
    settingsModal.classList.remove('hidden');
});

closeSettingsModal.addEventListener('click', () => {
    runUndoableAction(() => {
        levelConfig.scrollSpeed = Number(document.getElementById('set-scrollSpeed').value);
        levelConfig.gravity = Number(document.getElementById('set-gravity').value);
        levelConfig.floorEnabled = document.getElementById('set-floorEnabled').checked;
        levelConfig.antigravity = document.getElementById('set-antigravity').checked;
        levelConfig.yTrack = document.getElementById('set-yTrack').checked;
        levelConfig.gradientTopColor = document.getElementById('set-gradientTop').value;
        levelConfig.gradientBottomColor = document.getElementById('set-gradientBottom').value;
        
        if(editorContainer) editorContainer.style.background = `linear-gradient(to bottom, ${levelConfig.gradientTopColor}, ${levelConfig.gradientBottomColor})`;
        
        settingsModal.classList.add('hidden');
        draw();
    });
});

// Export
exportBtn.addEventListener('click', () => {
    const BULLET_TOOL_TYPES = new Set(['catBullet']);
    const bullets = [];
    const genericObjects = [];
    const shouldSkipExportedProperty = (obj, key) => {
        const def = getDefForObjectKey(obj.type, key);
        return !!(def && def.section === 'movement' && obj.eM !== true);
    };

    for (const obj of objects) {
        if (BULLET_TOOL_TYPES.has(obj.type)) {
            const exportedBullet = {
                x: obj.x,
                y: obj.y,
                a: Number((((obj.rotation || 0) * Math.PI) / 180).toFixed(3)),
                collison: obj.collison !== false
            };

            if (typeof obj.sp === 'number') {
                exportedBullet.sp = obj.sp;
            }

            for (const [key, value] of Object.entries(obj)) {
                if (key === 'type' || key === 'x' || key === 'y' || key === 'rotation' || key === 's' || key === 'a' || key === 'layerId') continue;
                if (value === undefined) continue;
                if (shouldSkipExportedProperty(obj, key)) continue;
                if (key in exportedBullet) continue;
                exportedBullet[key] = value;
            }

            bullets.push(exportedBullet);
            continue;
        }

        const exportedObj = {
            type: obj.type,
            x: obj.x,
            y: obj.y,
            collison: obj.collison !== false
        };
        if (obj.rotation) {
            // Convert degrees to radians and round to 3 decimal places
            exportedObj.a = Number((obj.rotation * Math.PI / 180).toFixed(3));
        }
        if (obj.s && obj.s !== 1) {
            const compensatedS = getCompensatedRenderScale(obj.type, obj.s);
            exportedObj.s = Number(compensatedS.toFixed(3));
        }
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'type' || key === 'x' || key === 'y' || key === 'rotation' || key === 's' || key === 'layerId') continue;
            if (value === undefined) continue;
            if (shouldSkipExportedProperty(obj, key)) continue;
            exportedObj[key] = value;
        }
        genericObjects.push(exportedObj);
    }

    const levelData = {
        name: "My Custom Level",
        description: "",
        version: 1.71,
        scrollSpeed: levelConfig.scrollSpeed,
        gravity: levelConfig.gravity,
        floor: levelConfig.floorEnabled,
        antigravity: levelConfig.antigravity,
        yTrack: levelConfig.yTrack,
        gradientTopColor: levelConfig.gradientTopColor,
        gradientBottomColor: levelConfig.gradientBottomColor,
        disableBackgroundMusic: false,
        midiConfig: { restartOnDeath: false, volume: 100 },
        birdStartX: birdStart.x,
        birdStartY: birdStart.y,
        pipes: [],
        bullets,
        bulletTriggers: [],
        layers: { currentLayer: 1, maxLayers: 3 },
        genericObjects,
        finishLineX: finishLineObj.x,
        completionRequirement: { type: "crossFinishLine" }
    };

    const dataStr = JSON.stringify(levelData, null, 2);
    jsonOutput.value = dataStr;
    exportModal.classList.remove('hidden');
    jsonOutput.select();
});

// Properties Panel Logic

var propFieldsSignature = '';

function getDefsForSection(defs, section) {
    if (section === 'main') return defs.filter(def => (def.section || 'main') === 'main');
    return defs.filter(def => (def.section || 'main') === section);
}

function getPropertyPanelContext() {
    if (currentTool !== 'none' && objectConfigs[currentTool]) {
        return { mode: 'placing', tool: currentTool };
    }
    if (selectedObjects.length > 0) {
        return { mode: 'selected' };
    }
    return { mode: 'none' };
}

function getVisiblePropertyDefs(context) {
    if (context.mode === 'placing') {
        return getObjectPropertyDefs(context.tool);
    }

    if (context.mode === 'selected') {
        const map = new Map();
        for (const obj of selectedObjects) {
            for (const def of getObjectPropertyDefs(obj.type)) {
                if (!map.has(def.key)) map.set(def.key, def);
            }
        }
        return Array.from(map.values());
    }

    return [];
}

function getDefForObjectKey(type, key) {
    return getObjectPropertyDefs(type).find(def => def.key === key) || null;
}

function parsePropertyInputValue(def, rawValue) {
    if (def.type === 'checkbox') {
        return !!rawValue;
    }
    if (def.type === 'number') {
        const parsed = Number(rawValue);
        if (!Number.isFinite(parsed)) return def.default;
        if (def.key === 'mA') {
            return degreesToMovementRadians(parsed);
        }
        return parsed;
    }
    return rawValue;
}

function getContextPropertyValue(context, def) {
    if (context.mode === 'placing') {
        const override = getToolOverride(context.tool, def.key);
        const value = override !== undefined ? override : def.default;
        if (def.key === 'mA') return movementRadiansToDegrees(value);
        return value;
    }

    if (context.mode === 'selected') {
        const withProperty = selectedObjects.filter(obj => !!getDefForObjectKey(obj.type, def.key));
        if (withProperty.length === 0) return def.default;
        const firstObj = withProperty[0];
        const value = firstObj[def.key] !== undefined ? firstObj[def.key] : def.default;
        if (def.key === 'mA') return movementRadiansToDegrees(value);
        return value;
    }

    if (def.key === 'mA') return movementRadiansToDegrees(def.default);
    return def.default;
}

function renderPropertyInputs(context, defs) {
    const signature = `${context.mode}|${context.tool || ''}|${defs.map(def => `${def.key}:${def.type}`).join('|')}`;
    if (signature === propFieldsSignature) return;

    propFieldsSignature = signature;
    propFieldsContainer.innerHTML = '';
    if (movementFieldsContainer) movementFieldsContainer.innerHTML = '';

    const mainDefs = getDefsForSection(defs, 'main');
    const movementDefs = getDefsForSection(defs, 'movement');

    if (movementDetailsEl) {
        movementDetailsEl.style.display = movementDefs.length > 0 ? 'block' : 'none';
    }

    const renderDef = (def, container) => {
        const label = document.createElement('label');
        label.textContent = `${def.label}:`;

        let input;
        if (def.type === 'select') {
            input = document.createElement('select');
            for (const optionValue of def.options || []) {
                const option = document.createElement('option');
                option.value = optionValue;
                option.textContent = optionValue;
                input.appendChild(option);
            }
        } else if (def.type === 'checkbox') {
            input = document.createElement('input');
            input.type = 'checkbox';
        } else {
            input = document.createElement('input');
            input.type = 'number';
            input.step = def.step !== undefined ? String(def.step) : 'any';
        }

        input.dataset.propKey = def.key;
        input.dataset.propType = def.type;
        label.appendChild(input);
        container.appendChild(label);
    };

    for (const def of mainDefs) {
        renderDef(def, propFieldsContainer);
    }

    if (movementFieldsContainer) {
        for (const def of movementDefs) {
            renderDef(def, movementFieldsContainer);
        }
    }
}

function updatePropertyInputValues(context, defs) {
    const movementEnabledDef = defs.find(def => def.key === 'eM');
    const movementEnabled = movementEnabledDef ? (getContextPropertyValue(context, movementEnabledDef) !== false) : false;

    for (const def of defs) {
        const input = propPanel.querySelector(`[data-prop-key="${def.key}"]`);
        if (!input || document.activeElement === input) continue;
        const value = getContextPropertyValue(context, def);
        if (def.type === 'checkbox') {
            input.checked = value !== false;
        } else {
            input.value = value ?? '';
        }

        if (def.section === 'movement' && def.key !== 'eM') {
            input.disabled = !movementEnabled;
            input.style.opacity = movementEnabled ? '1' : '0.5';
        }
    }
}

function updatePropertiesPanel() {
    const context = getPropertyPanelContext();
    const defs = getVisiblePropertyDefs(context);
    const isPlacingColor = context.mode === 'placing' && objectConfigs[context.tool] && objectConfigs[context.tool].colorable;
    const firstColorObj = selectedObjects.find(obj => objectConfigs[obj.type] && objectConfigs[obj.type].colorable);
    const isSelectingColorItem = !!firstColorObj;
    const hasAnyProps = defs.length > 0;

    if (!isPlacingColor && !isSelectingColorItem && !hasAnyProps) {
        propPanel.classList.add('closed');
        if (isColorPicking) setColorPickerActive(false);
        propFieldsContainer.innerHTML = '';
        if (movementFieldsContainer) movementFieldsContainer.innerHTML = '';
        if (movementDetailsEl) movementDetailsEl.style.display = 'none';
        propFieldsSignature = '';
        return;
    }

    propPanel.classList.remove('closed');

    if (propColorRow) {
        propColorRow.style.display = (isPlacingColor || isSelectingColorItem) ? 'flex' : 'none';
    }

    // Update color preview without disrupting active user input
    if ((isPlacingColor || isSelectingColorItem) && document.activeElement !== propColorInput) {
        if (isSelectingColorItem) {
            propColorInput.value = firstColorObj.color || levelConfig.lastUsedColor;
        } else {
            propColorInput.value = levelConfig.lastUsedColor;
        }
    }

    renderPropertyInputs(context, defs);
    updatePropertyInputValues(context, defs);
}

// Ensure the panel handles color changes dynamically
propColorInput.addEventListener('input', (e) => {
    runUndoableAction(() => {
        const val = e.target.value;
        applyColorToCurrentContext(val);
        draw();
    });
});

if (propColorPickerBtn) {
    propColorPickerBtn.addEventListener('click', () => {
        if (propPanel.classList.contains('closed') || propColorRow.style.display === 'none') return;
        setColorPickerActive(!isColorPicking);
    });
}

function handlePropertyInputChange(target) {
    const key = target.dataset ? target.dataset.propKey : null;
    if (!key) return;

    const context = getPropertyPanelContext();
    const defs = getVisiblePropertyDefs(context);
    const def = defs.find(item => item.key === key);
    if (!def) return;

    const rawValue = def.type === 'checkbox' ? target.checked : target.value;
    const newValue = parsePropertyInputValue(def, rawValue);

    runUndoableAction(() => {
        if (context.mode === 'placing') {
            setToolOverride(context.tool, key, newValue);
            if (key === 'collison') {
                previewScale = getSignedScaleFromCollison(previewScale || 1, newValue !== false);
            }
            draw();
            return;
        }

        if (context.mode === 'selected') {
            let changed = false;
            let needsZUpdate = false;
            for (const obj of selectedObjects) {
                if (!getDefForObjectKey(obj.type, key)) continue;
                if (!isObjectEditableInCurrentLayer(obj)) continue;
                obj[key] = newValue;
                if (key === 'collison') {
                    obj.s = getSignedScaleFromCollison(obj.s || 1, newValue !== false);
                }
                if (key === 'zIndex') {
                    needsZUpdate = true;
                }
                changed = true;
            }
            // Recompute all layer z values when zIndex changes, since a lower layer's
            // max z affects the base z of every layer above it.
            if (needsZUpdate) updateObjectLayerDepths();
            if (changed) draw();
        }
    });
}

propFieldsContainer.addEventListener('input', (e) => {
    handlePropertyInputChange(e.target);
});

if (movementFieldsContainer) {
    movementFieldsContainer.addEventListener('input', (e) => {
        handlePropertyInputChange(e.target);
    });
}

// Initial draw
draw();


