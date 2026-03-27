const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const editorContainer = document.getElementById('editor-container');
const propPanel = document.getElementById('properties-panel');
const propColorInput = document.getElementById('prop-blockColor');
const propColorRow = document.getElementById('prop-color-row');
const propFieldsContainer = document.getElementById('properties-fields');
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

const toolPropertyOverrides = {};
let layerState = {
    nextId: 2,
    activeId: 1,
    items: [
        { id: 1, name: 'Layer 1', hidden: false }
    ]
};
let draggingLayerId = null;
let objectClipboard = [];
const BASE_OBJECT_PROPERTY_DEFS = [
    { key: 'collison', label: 'Collison', type: 'checkbox', default: true }
];

const OBJECT_PROPERTY_DEFS = {
    catBullet: [
        { key: 'sp', label: 'Bullet Speed', type: 'number', default: 4, step: 0.01 }
    ],
    thwomp: [
        { key: 'uS', label: 'Up Speed', type: 'number', default: 91, step: 0.01 },
        { key: 'dS', label: 'Down Speed', type: 'number', default: 121, step: 0.01 },
        { key: 'mR', label: 'Move Range', type: 'number', default: 140, step: 0.01 },
        { key: 'tD', label: 'Top Delay (ms)', type: 'number', default: 4400, step: 1 },
        { key: 'bD', label: 'Bottom Delay (ms)', type: 'number', default: 3500, step: 1 },
        { key: 'direction', label: 'Direction', type: 'select', default: 'down', options: ['up', 'down'] },
        { key: 'st', label: 'State', type: 'select', default: 'moving_down', options: ['moving_down', 'moving_up', 'waiting_top', 'waiting_bottom'] }
    ],
    thwompPipe: [
        { key: 'uS', label: 'Up Speed', type: 'number', default: 91, step: 0.01 },
        { key: 'dS', label: 'Down Speed', type: 'number', default: 121, step: 0.01 },
        { key: 'mR', label: 'Move Range', type: 'number', default: 140, step: 0.01 },
        { key: 'tD', label: 'Top Delay (ms)', type: 'number', default: 4400, step: 1 },
        { key: 'bD', label: 'Bottom Delay (ms)', type: 'number', default: 3500, step: 1 },
        { key: 'direction', label: 'Direction', type: 'select', default: 'down', options: ['up', 'down'] },
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
    return [...BASE_OBJECT_PROPERTY_DEFS, ...(OBJECT_PROPERTY_DEFS[type] || [])];
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
    obj.z = getLayerZById(resolvedId);
}

function updateObjectLayerDepths() {
    for (const obj of objects) {
        if (!obj || obj.type === 'finishLine') continue;
        assignLayerToObject(obj, obj.layerId);
    }
}

function normalizeLayerStateForObjects() {
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
            layerState.items.push({ id, name: `Layer ${id}`, hidden: false });
        }
        layerState.nextId = neededLayers + 1;
        layerState.activeId = layerState.items[0].id;

        for (const obj of objectList) {
            const zIndex = Math.max(0, Math.round(((Number(obj.z) || 5) - 5) / 5));
            const targetIndex = Math.max(0, Math.min(layerState.items.length - 1, layerState.items.length - 1 - zIndex));
            assignLayerToObject(obj, layerState.items[targetIndex].id);
        }
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
    const layer = getLayerById(obj.layerId);
    if (layer && layer.hidden) return false;
    return obj.layerId === active.id;
}

function sanitizeSelectionForActiveLayer() {
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

        const nameEl = document.createElement('span');
        nameEl.className = 'layer-name';
        nameEl.textContent = layer.name;
        nameEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            startInlineLayerRename(layer.id);
        });

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
            renderLayersUI();
            draw();
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
            });
        });

        row.appendChild(nameEl);
        row.appendChild(hideBtn);
        layersListEl.appendChild(row);
    }
}

function createLayer() {
    runUndoableAction(() => {
        const id = layerState.nextId++;
        const layer = { id, name: `Layer ${id}`, hidden: false };
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
        const removedIndex = layerState.items.findIndex(layer => layer.id === removedId);
        layerState.items = layerState.items.filter(layer => layer.id !== removedId);

        const fallbackLayer = layerState.items[Math.min(Math.max(removedIndex, 0), layerState.items.length - 1)] || layerState.items[layerState.items.length - 1];
        for (const obj of objects) {
            if (obj.type === 'finishLine') continue;
            if (obj.layerId === removedId && fallbackLayer) {
                obj.layerId = fallbackLayer.id;
            }
        }

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
        const id = layerState.nextId++;
        const copy = {
            id,
            name: `${active.name} Copy`,
            hidden: active.hidden
        };

        const activeIndex = layerState.items.findIndex(layer => layer.id === active.id);
        const insertIndex = activeIndex >= 0 ? activeIndex : layerState.items.length;
        layerState.items.splice(insertIndex, 0, copy);
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
    renderLayersUI();
}

function setupLeftPanelToggle() {
    if (!toggleLeftPanelBtn || !leftPanel) return;

    toggleLeftPanelBtn.addEventListener('click', () => {
        leftPanel.classList.toggle('closed');
        toggleLeftPanelBtn.textContent = leftPanel.classList.contains('closed') ? '▶' : '◀';
    });
}

function getSignedScaleFromCollison(scale, collisonEnabled) {
    const magnitude = Math.max(0.1, Math.abs(scale || 1));
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
const MAX_TINT_CACHE_ENTRIES = 800;

function getTintCacheKey(img, color, width, height) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    return `${img.src}|${color}|${w}x${h}`;
}

function getTintedSprite(img, color, width, height) {
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
    _tintCtx.fillStyle = color;
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

// Selection & Drag State
let selectedObjects = [];
let isDraggingObjects = false;
let isBoxSelecting = false;
let selectionBoxStart = { x: 0, y: 0 };
let selectionBoxEnd = { x: 0, y: 0 };
let lastDrag = { x: 0, y: 0 };

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
    
    // Snap to grid intervals (width and height of the reference object)
    const snappedLocalX = Math.round(localX / activeGrid.w) * activeGrid.w;
    const snappedLocalY = Math.round(localY / activeGrid.h) * activeGrid.h;
    
    // Rotate back to world space
    const invRad = activeGrid.rotation * Math.PI / 180;
    const invCos = Math.cos(invRad);
    const invSin = Math.sin(invRad);
    
    const snappedX = activeGrid.cx + snappedLocalX * invCos - snappedLocalY * invSin;
    const snappedY = activeGrid.cy + snappedLocalX * invSin + snappedLocalY * invCos;
    
    return { x: snappedX, y: snappedY };
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

// Convert text to polygon using offscreen canvas + contour tracing
function textToPolygon() {
    if (!textToolContent || textToolContent.trim() === '') return [];

    // Render text to an offscreen canvas at high res
    const RENDER_SCALE = 2; // render at 2x for better contour quality
    const fontSize = textToolFontSize * RENDER_SCALE;
    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

    offCtx.font = `bold ${fontSize}px ${textToolFont}`;
    const metrics = offCtx.measureText(textToolContent);
    const textW = Math.ceil(metrics.width) + 20;
    const textH = Math.ceil(fontSize * 1.3) + 20;

    offCanvas.width = textW;
    offCanvas.height = textH;

    // Clear and draw text
    offCtx.clearRect(0, 0, textW, textH);
    offCtx.fillStyle = '#ffffff';
    offCtx.font = `bold ${fontSize}px ${textToolFont}`;
    offCtx.textBaseline = 'top';
    offCtx.fillText(textToolContent, 10, 10);

    // Get pixel data
    const imageData = offCtx.getImageData(0, 0, textW, textH);
    const data = imageData.data;

    // Create binary grid (1 = filled, 0 = empty) based on alpha
    const ALPHA_THRESHOLD = 80;
    const grid = new Uint8Array(textW * textH);
    for (let i = 0; i < textW * textH; i++) {
        grid[i] = data[i * 4 + 3] >= ALPHA_THRESHOLD ? 1 : 0;
    }

    // Extract contour using marching squares
    const contours = extractContours(grid, textW, textH);
    if (contours.length === 0) return [];

    // Transform contour points from pixel space to world space
    const { textW: worldTextW, textH: worldTextH } = getTextMetrics();
    const worldOriginX = textToolPosition.x - worldTextW / 2;
    const worldOriginY = textToolPosition.y - worldTextH;

    // Scale from pixel coords to world coords cleanly
    const pixToWorldX = (px) => worldOriginX + (px - 10) / RENDER_SCALE;
    const pixToWorldY = (py) => worldOriginY + (py - 10) / RENDER_SCALE;

    // Convert, simplify, and concatenate all contours
    let allSimplified = contours.map(c => simplifyPolygon(c.map(p => ({
        x: pixToWorldX(p.x),
        y: pixToWorldY(p.y)
    })), 0.5));

    if (allSimplified.length === 0) return [];

    // Stitch all disconnected contours together into one continuous polygon using zero-width bridge segments
    // This allows the single `lassoPolygon` state and fill algorithms to "see" multiple letters and inner holes 
    // seamlessly, because connecting bridges effectively cross paths twice and have zero inner area.
    const stitched = [];
    const root = allSimplified[0][0];

    for (let i = 0; i < allSimplified.length; i++) {
        const poly = allSimplified[i];
        if (i > 0) {
            stitched.push(root);
            stitched.push(poly[0]);
        }
        stitched.push(...poly);
        stitched.push(poly[0]); // explicitly close this sub-loop
        if (i > 0) {
            stitched.push(root);
        }
    }

    return stitched;
}

// Marching squares contour extraction
function extractContours(grid, width, height) {
    const visited = new Uint8Array(width * height);
    const contours = [];

    // Find contour starting points (transitions from 0 to 1 horizontally)
    for (let y = 0; y < height - 1; y++) {
        for (let x = 0; x < width - 1; x++) {
            const idx = y * width + x;
            if (visited[idx]) continue;

            // Check if this is a boundary cell
            const tl = grid[idx];
            const tr = grid[idx + 1];
            const bl = grid[(y + 1) * width + x];
            const br = grid[(y + 1) * width + x + 1];
            const cellType = (tl << 3) | (tr << 2) | (br << 1) | bl;

            if (cellType === 0 || cellType === 15) continue; // fully outside or fully inside

            // Trace contour from this cell
            const contour = traceContour(grid, width, height, x, y, visited);
            if (contour && contour.length >= 6) {
                contours.push(contour);
            }
        }
    }

    return contours;
}

function traceContour(grid, width, height, startX, startY, visited) {
    const points = [];
    let x = startX;
    let y = startY;
    let prevDir = -1; // direction we came from
    const maxSteps = width * height;
    let steps = 0;

    do {
        if (steps++ > maxSteps) break;

        const idx = y * width + x;
        if (x < 0 || x >= width - 1 || y < 0 || y >= height - 1) break;

        visited[idx] = 1;

        const tl = grid[idx];
        const tr = grid[idx + 1];
        const bl = grid[(y + 1) * width + x];
        const br = grid[(y + 1) * width + x + 1];
        const cellType = (tl << 3) | (tr << 2) | (br << 1) | bl;

        // Get interpolated edge point for this cell
        let px = x + 0.5;
        let py = y + 0.5;

        switch (cellType) {
            case 1: case 14: px = x; py = y + 0.5; break;
            case 2: case 13: px = x + 0.5; py = y + 1; break;
            case 3: case 12: px = x; py = y + 0.5; break;
            case 4: case 11: px = x + 1; py = y + 0.5; break;
            case 6: case 9: px = x + 0.5; py = y + 1; break;
            case 7: case 8: px = x; py = y + 0.5; break;
            default: px = x + 0.5; py = y + 0.5; break;
        }

        points.push({ x: px, y: py });

        // Determine next cell based on marching squares direction
        let nextX = x;
        let nextY = y;

        switch (cellType) {
            case 1: nextX--; break; // BL: down to left
            case 2: nextY++; break; // BR: right to down
            case 3: nextX--; break; // BL, BR: right to left
            case 4: nextX++; break; // TR: up to right
            case 5: // BL, TR
                if (prevDir === 2) nextX--; else nextX++; break;
            case 6: nextY++; break; // BR, TR: up to down
            case 7: nextX--; break; // BL, BR, TR: up to left
            case 8: nextY--; break; // TL: left to up
            case 9: nextY--; break; // TL, BL: down to up
            case 10: // TL, BR
                if (prevDir === 3) nextY--; else nextY++; break;
            case 11: nextY--; break; // TL, BL, BR: right to up
            case 12: nextX++; break; // TL, TR: left to right
            case 13: nextX++; break; // TL, TR, BL: down to right
            case 14: nextY++; break; // TL, TR, BR: left to down
            default: break;
        }

        if (nextX > x) prevDir = 1;      // moved right
        else if (nextX < x) prevDir = 3; // moved left
        else if (nextY > y) prevDir = 2; // moved down
        else prevDir = 0;                // moved up

        x = nextX;
        y = nextY;

        if (x === startX && y === startY) break;
    } while (true);

    return points;
}

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
    const scale = hasTool ? Math.abs(previewScale || 1) : 1;
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

function orientation(a, b, c) {
    const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
    if (Math.abs(value) < 1e-9) return 0;
    return value > 0 ? 1 : 2;
}

function onSegment(a, b, c) {
    return b.x <= Math.max(a.x, c.x) + 1e-9
        && b.x + 1e-9 >= Math.min(a.x, c.x)
        && b.y <= Math.max(a.y, c.y) + 1e-9
        && b.y + 1e-9 >= Math.min(a.y, c.y);
}

function segmentsIntersect(p1, q1, p2, q2) {
    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);

    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    return false;
}

function polygonRectOverlap(polygon, rect) {
    if (!polygon || polygon.length < 3) return false;

    const rectCorners = [
        { x: rect.minX, y: rect.minY },
        { x: rect.maxX, y: rect.minY },
        { x: rect.maxX, y: rect.maxY },
        { x: rect.minX, y: rect.maxY }
    ];

    for (const point of polygon) {
        if (point.x >= rect.minX && point.x <= rect.maxX && point.y >= rect.minY && point.y <= rect.maxY) {
            return true;
        }
    }

    for (const corner of rectCorners) {
        if (pointInPolygon(corner, polygon)) return true;
    }

    const rectEdges = [
        [rectCorners[0], rectCorners[1]],
        [rectCorners[1], rectCorners[2]],
        [rectCorners[2], rectCorners[3]],
        [rectCorners[3], rectCorners[0]]
    ];

    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        for (const [r1, r2] of rectEdges) {
            if (segmentsIntersect(a, b, r1, r2)) return true;
        }
    }

    return false;
}

function canPreviewLassoFillAt(x, y) {
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

function rectFromMinSize(minX, minY, size) {
    return {
        minX,
        minY,
        maxX: minX + size,
        maxY: minY + size,
        size,
        cx: minX + size / 2,
        cy: minY + size / 2
    };
}

function isRectFullyInsidePolygon(rect, polygon) {
    const corners = [
        { x: rect.minX, y: rect.minY },
        { x: rect.maxX, y: rect.minY },
        { x: rect.maxX, y: rect.maxY },
        { x: rect.minX, y: rect.maxY }
    ];
    return corners.every(corner => pointInPolygon(corner, polygon));
}

function classifyRectAgainstPolygon(rect, polygon) {
    if (!polygonRectOverlap(polygon, rect)) return 'outside';
    if (isRectFullyInsidePolygon(rect, polygon)) return 'inside';
    return 'intersect';
}

function collectAdaptiveSquaresForPolygon(polygon, baseSize, maxDepth) {
    const bounds = getPolygonBounds(polygon);
    const startX = Math.floor(bounds.minX / baseSize) * baseSize;
    const startY = Math.floor(bounds.minY / baseSize) * baseSize;
    const endX = Math.ceil(bounds.maxX / baseSize) * baseSize;
    const endY = Math.ceil(bounds.maxY / baseSize) * baseSize;

    const squares = [];
    const maxSquares = 20000;

    const visitRect = (rect, depth) => {
        if (squares.length >= maxSquares) return;
        const cls = classifyRectAgainstPolygon(rect, polygon);
        if (cls === 'outside') return;

        if (cls === 'inside' || depth >= maxDepth) {
            squares.push({ ...rect, cls });
            return;
        }

        const half = rect.size / 2;
        if (half < 2) {
            squares.push({ ...rect, cls });
            return;
        }

        visitRect(rectFromMinSize(rect.minX, rect.minY, half), depth + 1);
        visitRect(rectFromMinSize(rect.minX + half, rect.minY, half), depth + 1);
        visitRect(rectFromMinSize(rect.minX, rect.minY + half, half), depth + 1);
        visitRect(rectFromMinSize(rect.minX + half, rect.minY + half, half), depth + 1);
    };

    for (let y = startY; y < endY; y += baseSize) {
        for (let x = startX; x < endX; x += baseSize) {
            visitRect(rectFromMinSize(x, y, baseSize), 0);
            if (squares.length >= maxSquares) break;
        }
        if (squares.length >= maxSquares) break;
    }

    return squares;
}

function getNearestBoundarySample(point, polygon) {
    let best = {
        dist: Number.POSITIVE_INFINITY,
        angleDeg: 0,
        nearestX: point.x,
        nearestY: point.y,
        inwardX: 0,
        inwardY: 0
    };

    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        const abX = b.x - a.x;
        const abY = b.y - a.y;
        const abLenSq = abX * abX + abY * abY;
        if (abLenSq < 1e-9) continue;

        const apX = point.x - a.x;
        const apY = point.y - a.y;
        const t = Math.max(0, Math.min(1, (apX * abX + apY * abY) / abLenSq));
        const nearX = a.x + abX * t;
        const nearY = a.y + abY * t;

        const dx = point.x - nearX;
        const dy = point.y - nearY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist >= best.dist) continue;

        const segLen = Math.sqrt(abLenSq);
        const nx = -abY / segLen;
        const ny = abX / segLen;
        const testA = { x: nearX + nx * 4, y: nearY + ny * 4 };
        const testB = { x: nearX - nx * 4, y: nearY - ny * 4 };

        let inwardX = nx;
        let inwardY = ny;
        const insideA = pointInPolygon(testA, polygon);
        const insideB = pointInPolygon(testB, polygon);
        if (insideB && !insideA) {
            inwardX = -nx;
            inwardY = -ny;
        }

        best = {
            dist,
            angleDeg: Math.atan2(abY, abX) * 180 / Math.PI,
            nearestX: nearX,
            nearestY: nearY,
            inwardX,
            inwardY
        };
    }

    return best;
}

function normalizeAngleDeg(angle) {
    let value = angle;
    while (value > 180) value -= 360;
    while (value < -180) value += 360;
    return value;
}

function snapAngleDeg(angle, step = 3) {
    return Math.round(angle / step) * step;
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function rotatePointAround(point, center, angleDeg) {
    const rad = angleDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    return {
        x: center.x + dx * cos - dy * sin,
        y: center.y + dx * sin + dy * cos
    };
}

function getScanlineIntersections(polygon, y) {
    const intersections = [];
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        const yMin = Math.min(a.y, b.y);
        const yMax = Math.max(a.y, b.y);
        if (y < yMin || y >= yMax || Math.abs(a.y - b.y) < 1e-9) continue;

        const t = (y - a.y) / (b.y - a.y);
        intersections.push(a.x + t * (b.x - a.x));
    }
    intersections.sort((left, right) => left - right);
    return intersections;
}

function isPointOnPolygonEdge(point, polygon) {
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i];
        const b = polygon[(i + 1) % polygon.length];
        if (orientation(a, point, b) === 0 && onSegment(a, point, b)) {
            return true;
        }
    }
    return false;
}

function pointInPolygonInclusive(point, polygon) {
    return pointInPolygon(point, polygon) || isPointOnPolygonEdge(point, polygon);
}

function getRotatedRectPoints(cx, cy, w, h, rotationDeg) {
    const hw = w / 2;
    const hh = h / 2;
    const rad = rotationDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    const rotatePoint = (lx, ly) => ({
        x: cx + lx * cos - ly * sin,
        y: cy + lx * sin + ly * cos
    });

    const c1 = rotatePoint(-hw, -hh);
    const c2 = rotatePoint(hw, -hh);
    const c3 = rotatePoint(hw, hh);
    const c4 = rotatePoint(-hw, hh);

    const m1 = rotatePoint(0, -hh);
    const m2 = rotatePoint(hw, 0);
    const m3 = rotatePoint(0, hh);
    const m4 = rotatePoint(-hw, 0);

    return {
        corners: [c1, c2, c3, c4],
        samples: [c1, c2, c3, c4, m1, m2, m3, m4, { x: cx, y: cy }]
    };
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

function isRotatedRectInsidePolygon(cx, cy, w, h, rotationDeg, polygon) {
    const rect = getRotatedRectPoints(cx, cy, w, h, rotationDeg);
    return rect.samples.every(sample => pointInPolygonInclusive(sample, polygon));
}

function fillLassoWithCurrentTool() {
    if (!lassoPolygon || lassoPolygon.length < 3) return;
    if (!objectConfigs[currentTool]) return;

    const dims = getToolDimensions(currentTool);
    const baseScale = Math.abs(previewScale || 1);
    const tileW = Math.max(1, dims.w * baseScale);
    const tileH = Math.max(1, dims.h * baseScale);
    const rotDeg = previewRotation || 0;
    const rotRad = rotDeg * Math.PI / 180;
    const cosR = Math.cos(rotRad);
    const sinR = Math.sin(rotRad);

    const bounds = getPolygonBounds(lassoPolygon);
    const maxObjects = 45000;
    const placedTiles = []; // track {x, y, w, h, rot} for coverage checks

    // Inset polygon slightly (by 0.5px) to ensure tiles don't touch the boundary
    // This provides a safety margin against floating-point edge cases
    const insetPolygon = insetPolygonByAmount(lassoPolygon, 0.5);
    const checkPolygon = (insetPolygon && insetPolygon.length >= 3) ? insetPolygon : lassoPolygon;

    function placeTile(cx, cy, scale, rot) {
        if (objects.length >= maxObjects) return false;
        const s = Number(scale.toFixed(3));
        const w = dims.w * s;
        const h = dims.h * s;
        // Verify ALL sample points of the rotated rect are inside the polygon
        if (!isRotatedRectInsidePolygon(cx, cy, w, h, rot, checkPolygon)) return false;

        objects.push(createPlacedObject(currentTool, cx, cy, Number(rot.toFixed(2)), s));
        placedTiles.push({ x: cx, y: cy, w, h, rot });
        markUndoDirty();
        return true;
    }

    function isPointCoveredByPlacedTile(px, py) {
        for (let i = placedTiles.length - 1; i >= 0; i--) {
            const t = placedTiles[i];
            if (pointInRotatedRect({ x: px, y: py }, t.x, t.y, t.w, t.h, t.rot)) {
                return true;
            }
        }
        return false;
    }

    // === PHASE 1: Interior grid fill ===
    // Transform the bounding box into the rotated coordinate frame, lay a grid, transform back
    const pad = Math.max(tileW, tileH) * 2;
    const expandedMinX = bounds.minX - pad;
    const expandedMinY = bounds.minY - pad;
    const expandedMaxX = bounds.maxX + pad;
    const expandedMaxY = bounds.maxY + pad;

    // Corners of expanded bounding box
    const bboxCorners = [
        { x: expandedMinX, y: expandedMinY },
        { x: expandedMaxX, y: expandedMinY },
        { x: expandedMaxX, y: expandedMaxY },
        { x: expandedMinX, y: expandedMaxY }
    ];

    // Rotate corners into tile-local frame
    const rotatedCorners = bboxCorners.map(c => ({
        u: c.x * cosR + c.y * sinR,
        v: -c.x * sinR + c.y * cosR
    }));

    const minU = Math.min(...rotatedCorners.map(c => c.u));
    const maxU = Math.max(...rotatedCorners.map(c => c.u));
    const minV = Math.min(...rotatedCorners.map(c => c.v));
    const maxV = Math.max(...rotatedCorners.map(c => c.v));

    // Snap grid start to tile-size multiples
    const gridStartU = Math.floor(minU / tileW) * tileW + tileW / 2;
    const gridStartV = Math.floor(minV / tileH) * tileH + tileH / 2;

    for (let v = gridStartV; v <= maxV; v += tileH) {
        for (let u = gridStartU; u <= maxU; u += tileW) {
            // Transform back to world coordinates
            const wx = u * cosR - v * sinR;
            const wy = u * sinR + v * cosR;

            // Quick reject: is center even inside polygon?
            if (!pointInPolygon({ x: wx, y: wy }, lassoPolygon)) continue;

            placeTile(wx, wy, baseScale, rotDeg);
        }
    }

    // === PHASE 2: Boundary coverage with shrinking tiles ===
    // Scan a fine grid and for any uncovered interior point, try to place a tile
    const minTileDim = Math.min(tileW, tileH);
    const scanSpacing = Math.max(1.5, minTileDim * 0.15);
    const scaleSteps = [];
    for (let s = 1.0; s >= 0.12; s -= 0.05) {
        scaleSteps.push(s);
    }
    // Add very small steps for tight corners
    scaleSteps.push(0.10, 0.08, 0.06, 0.04);

    // Build spatial index for faster coverage checks
    const cellSize = Math.max(tileW, tileH) * 1.5;
    const spatialGrid = new Map();

    function getSpatialKey(x, y) {
        return `${Math.floor(x / cellSize)},${Math.floor(y / cellSize)}`;
    }

    function addToSpatialGrid(tile) {
        // Add tile to all cells it could overlap
        const r = Math.max(tile.w, tile.h) * 0.71; // half-diagonal
        const minCX = Math.floor((tile.x - r) / cellSize);
        const maxCX = Math.floor((tile.x + r) / cellSize);
        const minCY = Math.floor((tile.y - r) / cellSize);
        const maxCY = Math.floor((tile.y + r) / cellSize);
        for (let cy = minCY; cy <= maxCY; cy++) {
            for (let cx = minCX; cx <= maxCX; cx++) {
                const key = `${cx},${cy}`;
                let bucket = spatialGrid.get(key);
                if (!bucket) {
                    bucket = [];
                    spatialGrid.set(key, bucket);
                }
                bucket.push(tile);
            }
        }
    }

    function isPointCoveredSpatial(px, py) {
        const key = getSpatialKey(px, py);
        const bucket = spatialGrid.get(key);
        if (!bucket) return false;
        for (let i = bucket.length - 1; i >= 0; i--) {
            const t = bucket[i];
            if (pointInRotatedRect({ x: px, y: py }, t.x, t.y, t.w, t.h, t.rot)) {
                return true;
            }
        }
        return false;
    }

    // Index all Phase 1 tiles
    for (const tile of placedTiles) {
        addToSpatialGrid(tile);
    }

    // Collect uncovered interior points
    const uncoveredPoints = [];
    for (let sy = bounds.minY; sy <= bounds.maxY; sy += scanSpacing) {
        // Use scanline intersections for fast inside detection
        const intersections = getScanlineIntersections(lassoPolygon, sy);
        for (let si = 0; si + 1 < intersections.length; si += 2) {
            const xStart = intersections[si];
            const xEnd = intersections[si + 1];
            for (let sx = Math.ceil(xStart / scanSpacing) * scanSpacing; sx <= xEnd; sx += scanSpacing) {
                if (!isPointCoveredSpatial(sx, sy)) {
                    uncoveredPoints.push({ x: sx, y: sy });
                }
            }
        }
    }

    // Helper: get rotation candidates for a boundary point (edge-aligned + blends)
    function getBoundaryRotations(px, py) {
        const near = getNearestBoundarySample({ x: px, y: py }, lassoPolygon);
        const edgeAngle = near.angleDeg;
        // Try the edge tangent, perpendicular to edge, base rotation, and blends
        const candidates = [
            edgeAngle,
            edgeAngle + 90,
            edgeAngle - 90,
            rotDeg,
            // Blends between base rotation and edge tangent for smoother transitions
            rotDeg + normalizeAngleDeg(edgeAngle - rotDeg) * 0.25,
            rotDeg + normalizeAngleDeg(edgeAngle - rotDeg) * 0.5,
            rotDeg + normalizeAngleDeg(edgeAngle - rotDeg) * 0.75,
            edgeAngle + 45,
            edgeAngle - 45,
        ];
        return candidates.map(a => snapAngleDeg(normalizeAngleDeg(a), 1));
    }

    // Try to cover each uncovered point
    for (const pt of uncoveredPoints) {
        if (objects.length >= maxObjects) break;
        if (isPointCoveredSpatial(pt.x, pt.y)) continue; // may have been covered by a nearby placement

        const rotCandidates = getBoundaryRotations(pt.x, pt.y);
        let placed = false;
        for (const sFrac of scaleSteps) {
            if (placed) break;
            const tryScale = baseScale * sFrac;
            for (const tryRot of rotCandidates) {
                if (placeTile(pt.x, pt.y, tryScale, tryRot)) {
                    addToSpatialGrid(placedTiles[placedTiles.length - 1]);
                    placed = true;
                    break;
                }
            }
        }
    }

    // === PHASE 3: Final gap closure ===
    // Even finer scan to catch any remaining micro-gaps
    const fineSpacing = Math.max(1, minTileDim * 0.06);
    const fineMinScale = baseScale * 0.04;

    for (let sy = bounds.minY; sy <= bounds.maxY; sy += fineSpacing) {
        const intersections = getScanlineIntersections(lassoPolygon, sy);
        for (let si = 0; si + 1 < intersections.length; si += 2) {
            const xStart = intersections[si];
            const xEnd = intersections[si + 1];
            for (let sx = Math.ceil(xStart / fineSpacing) * fineSpacing; sx <= xEnd; sx += fineSpacing) {
                if (objects.length >= maxObjects) break;
                if (isPointCoveredSpatial(sx, sy)) continue;
                if (!pointInPolygonInclusive({ x: sx, y: sy }, lassoPolygon)) continue;

                // Try progressively smaller tiles with edge-aligned rotations
                const fineRotCandidates = getBoundaryRotations(sx, sy);
                let finePlaced = false;
                for (const sFrac of scaleSteps) {
                    if (finePlaced) break;
                    const tryScale = baseScale * sFrac;
                    if (tryScale < fineMinScale) break;
                    for (const tryRot of fineRotCandidates) {
                        if (placeTile(sx, sy, tryScale, tryRot)) {
                            addToSpatialGrid(placedTiles[placedTiles.length - 1]);
                            finePlaced = true;
                            break;
                        }
                    }
                }
            }
        }
    }
}

// Inset a polygon by a fixed pixel amount (approximate via offsetting vertices along averaged normals)
function insetPolygonByAmount(polygon, amount) {
    if (!polygon || polygon.length < 3) return polygon;
    const n = polygon.length;
    const result = [];

    for (let i = 0; i < n; i++) {
        const prev = polygon[(i - 1 + n) % n];
        const curr = polygon[i];
        const next = polygon[(i + 1) % n];

        // Edge normals (pointing inward for CW polygon, we'll check)
        const e1x = curr.x - prev.x;
        const e1y = curr.y - prev.y;
        const e1Len = Math.hypot(e1x, e1y) || 1;
        const n1x = -e1y / e1Len;
        const n1y = e1x / e1Len;

        const e2x = next.x - curr.x;
        const e2y = next.y - curr.y;
        const e2Len = Math.hypot(e2x, e2y) || 1;
        const n2x = -e2y / e2Len;
        const n2y = e2x / e2Len;

        // Average normal
        let avgNx = n1x + n2x;
        let avgNy = n1y + n2y;
        const avgLen = Math.hypot(avgNx, avgNy);
        if (avgLen < 1e-9) {
            avgNx = n1x;
            avgNy = n1y;
        } else {
            avgNx /= avgLen;
            avgNy /= avgLen;
        }

        // Determine which direction is inward by testing
        const testInward = { x: curr.x + avgNx * 2, y: curr.y + avgNy * 2 };
        const testOutward = { x: curr.x - avgNx * 2, y: curr.y - avgNy * 2 };

        let inwardNx = avgNx;
        let inwardNy = avgNy;
        if (pointInPolygon(testOutward, polygon) && !pointInPolygon(testInward, polygon)) {
            inwardNx = -avgNx;
            inwardNy = -avgNy;
        }

        result.push({
            x: curr.x + inwardNx * amount,
            y: curr.y + inwardNy * amount
        });
    }

    return result;
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
                        { id: 1, name: 'Layer 1', hidden: false }
                    ]
                };
                birdStart = { x: 100, y: 300 };
                finishLineObj = { type: 'finishLine', x: 1200, y: 0 };
                renderLayersUI();
                draw();
            });
        }
    });
}

// Keyboard Interaction
window.addEventListener('keydown', (e) => {
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
    if (e.key === 'Backspace' || e.key === 'Delete') {
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
                let cx = 0, cy = 0;
                selectedObjects.forEach(obj => { cx += obj.x; cy += obj.y; });
                cx /= selectedObjects.length;
                cy /= selectedObjects.length;

                let currentAngle = selectedObjects[0].rotation || 0;
                let newAngle;
                if (snapAmount > 0) {
                    newAngle = Math.floor(currentAngle / 45) * 45 + 45;
                } else {
                    newAngle = Math.ceil(currentAngle / 45) * 45 - 45;
                }
                let angleDelta = newAngle - currentAngle;
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
canvas.addEventListener('mouseenter', () => isMouseOnCanvas = true);
canvas.addEventListener('mouseleave', () => {
    isMouseOnCanvas = false;
    draw();
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1) { // Middle click for panning
        isPanning = true;
        startPan = { x: e.clientX - camera.x, y: e.clientY - camera.y };
        canvas.style.cursor = 'grabbing';
        return;
    }

    const rect = canvas.getBoundingClientRect();
    // Convert screen coordinates to game world coordinates
    let gameX = (e.clientX - rect.left - camera.x) / camera.zoom;
    let gameY = (e.clientY - rect.top - camera.y) / camera.zoom;

    // Apply grid snap
    if (activeGrid && currentTool !== 'grid' && currentTool !== 'none' && currentTool !== 'lasso' && currentTool !== 'brush' && currentTool !== 'text') {
        const snapped = applyGridSnap(gameX, gameY);
        gameX = snapped.x;
        gameY = snapped.y;
    }

    if (e.button === 0) { // Left click
        if (currentTool === 'grid') {
            const clickedObj = getObjectAt(gameX, gameY);
            if (clickedObj && clickedObj.type !== 'finishLine' && objectConfigs[clickedObj.type]) {
                const dims = getToolDimensions(clickedObj.type);
                activeGrid = {
                    cx: clickedObj.x,
                    cy: clickedObj.y,
                    w: Math.max(1, dims.w * Math.abs(clickedObj.s || 1)),
                    h: Math.max(1, dims.h * Math.abs(clickedObj.s || 1)),
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

        if (lassoPolygon.length >= 3) {
            if (currentTool !== 'none' && canPreviewLassoFillAt(gameX, gameY)) {
                runUndoableAction(() => {
                    fillLassoWithCurrentTool();
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
            placedTilesThisDrag.set('0,0', anchorObj);
            draw();
        } else if (currentTool === 'none') {
            beginUndoBatch();
            let clickedObj = getObjectAt(gameX, gameY);
            if (clickedObj) {
                if (!selectedObjects.includes(clickedObj)) {
                    selectedObjects = [clickedObj];
                    markUndoDirty();
                }
                isDraggingObjects = true;
                lastDrag = { x: gameX, y: gameY };
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

    if (isPanning) {
        camera.x = e.clientX - startPan.x;
        camera.y = e.clientY - startPan.y;
    }
    
    // Convert screen coordinates to game world coordinates
    let gameX = (e.clientX - rect.left - camera.x) / camera.zoom;
    let gameY = (e.clientY - rect.top - camera.y) / camera.zoom;

    // Apply grid snap
    if (activeGrid && currentTool !== 'grid' && currentTool !== 'none' && currentTool !== 'lasso' && currentTool !== 'brush' && currentTool !== 'text') {
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
        const cellW = dims.w * scale;
        const cellH = dims.h * scale;
        
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
    } else if (isDraggingObjects) {
        const dx = gameX - lastDrag.x;
        const dy = gameY - lastDrag.y;
        if (dx !== 0 || dy !== 0) markUndoDirty();
        selectedObjects.forEach(obj => {
            obj.x += dx;
            if (obj.type !== 'finishLine') {
                obj.y += dy;
            }
        });
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
    
    draw();
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 1) {
        isPanning = false;
        canvas.style.cursor = 'default';
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
        isDraggingObjects = false;
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
    if (isDrawingLasso || isTiling || isDraggingObjects || isBoxSelecting) {
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

        if (currentTool === 'none' && selectedObjects.length > 0) {
            runUndoableAction(() => {
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
                    const nextMagnitude = Math.max(0.1, Math.abs(currentScale) * factor);
                    obj.s = getSignedScaleFromCollison(nextMagnitude, collisonEnabled);
                    obj.s = Number(obj.s.toFixed(2));
                });
                draw();
            });
        } else if (currentTool !== 'none') {
            runUndoableAction(() => {
                const collisonEnabled = getToolOverride(currentTool, 'collison') !== false;
                const nextMagnitude = Math.max(0.1, Math.abs(previewScale || 1) * factor);
                previewScale = getSignedScaleFromCollison(nextMagnitude, collisonEnabled);
                previewScale = Number(previewScale.toFixed(2));
                draw();
            });
        }
        return;
    }
    
    // Ctrl + Scroll to carefully rotate the preview
    if (e.ctrlKey) {
        const rotationSpeed = 5; 
        const amount = e.deltaY > 0 ? rotationSpeed : -rotationSpeed;
        
        if (currentTool === 'none' && selectedObjects.length > 0) {
            runUndoableAction(() => {
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
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, width, height);

        ctx.save();

        // Apply Camera
        ctx.translate(camera.x, camera.y);
        ctx.scale(camera.zoom, camera.zoom);

    // Draw objects (render in array order so newest objects appear on top)
    const sortedObjects = [...objects].sort((a, b) => {
        const za = Number.isFinite(a.z) ? a.z : 0;
        const zb = Number.isFinite(b.z) ? b.z : 0;
        return za - zb;
    });

    sortedObjects.forEach(obj => {
        if (isLayerHiddenForObject(obj)) return;
        const config = objectConfigs[obj.type];
        if (config) {
            ctx.save();
            if (!isObjectEditableInCurrentLayer(obj)) {
                ctx.globalAlpha = 0.72;
            }
            ctx.translate(obj.x, obj.y);
            ctx.rotate(obj.rotation * Math.PI / 180);
            if (obj.s !== undefined && obj.s !== 1) ctx.scale(obj.s, obj.s);

            const img = objectImages[obj.type];
            let w = config.width || SPIKE_WIDTH;
            let h = w;

            let baseW = img ? (img.naturalWidth || img.width) : 0;
            let baseH = img ? (img.naturalHeight || img.height) : 0;

            if (img && img.complete && baseW !== 0) {
                if (config.heightMode === 'aspect') {
                    h = baseH * (w / baseW);
                } else if (config.heightMode === 'native' || config.heightMode === undefined && !config.width) {
                    h = baseH;
                }

                if (config.colorable) {
                    drawTintedImage(ctx, img, obj.color || '#ffffff', -w / 2, -h / 2, w, h);
                } else {
                    ctx.drawImage(img, -w / 2, -h / 2, w, h);
                }
            } else {
                ctx.fillStyle = config.fallbackColor || '#ff8888';
                ctx.fillRect(-w / 2, -h / 2, w, h);
            }

            if (selectedObjects.includes(obj)) {
                ctx.strokeStyle = config.highlight || '#00ffcc';
                const zoomComp = Math.max(1, camera.zoom);
                const outlinePad = 1.65 / zoomComp;
                ctx.lineWidth = 1.9 / zoomComp;
                ctx.strokeRect(-w / 2 - outlinePad, -h / 2 - outlinePad, w + outlinePad * 2, h + outlinePad * 2);
            }
            ctx.restore();
        }
    });

    // Draw Preview Overlay (Ghosts)
    if (isMouseOnCanvas && currentTool !== 'none' && objectConfigs[currentTool]) {
        const config = objectConfigs[currentTool];
        ctx.save();
        ctx.globalAlpha = 0.5;

        ctx.translate(previewX, previewY);
        ctx.rotate(previewRotation * Math.PI / 180);
        if (previewScale !== 1) ctx.scale(previewScale, previewScale);

        const img = objectImages[currentTool];
        let w = config.width || SPIKE_WIDTH;
        let h = w;

        let baseW = img ? (img.naturalWidth || img.width) : 0;
        let baseH = img ? (img.naturalHeight || img.height) : 0;

        if (img && img.complete && baseW !== 0) {
            if (config.heightMode === 'aspect') {
                h = baseH * (w / baseW);
            } else if (config.heightMode === 'native' || config.heightMode === undefined && !config.width) {
                h = baseH;
            }

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
        const spacing = 14 / camera.zoom;
        const minX = Math.min(...lassoPolygon.map(point => point.x)) - 100;
        const maxX = Math.max(...lassoPolygon.map(point => point.x)) + 100;
        const minY = Math.min(...lassoPolygon.map(point => point.y)) - 100;
        const maxY = Math.max(...lassoPolygon.map(point => point.y)) + 100;

        for (let x = minX - (maxY - minY); x <= maxX + (maxY - minY); x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, minY);
            ctx.lineTo(x + (maxY - minY), maxY);
            ctx.stroke();
        }

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
            exportedObj.s = obj.s;
        }
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'type' || key === 'x' || key === 'y' || key === 'rotation' || key === 's' || key === 'layerId') continue;
            if (value === undefined) continue;
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
        return parsed;
    }
    return rawValue;
}

function getContextPropertyValue(context, def) {
    if (context.mode === 'placing') {
        const override = getToolOverride(context.tool, def.key);
        return override !== undefined ? override : def.default;
    }

    if (context.mode === 'selected') {
        const withProperty = selectedObjects.filter(obj => !!getDefForObjectKey(obj.type, def.key));
        if (withProperty.length === 0) return def.default;
        const firstObj = withProperty[0];
        return firstObj[def.key] !== undefined ? firstObj[def.key] : def.default;
    }

    return def.default;
}

function renderPropertyInputs(context, defs) {
    const signature = `${context.mode}|${context.tool || ''}|${defs.map(def => `${def.key}:${def.type}`).join('|')}`;
    if (signature === propFieldsSignature) return;

    propFieldsSignature = signature;
    propFieldsContainer.innerHTML = '';

    for (const def of defs) {
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
        propFieldsContainer.appendChild(label);
    }
}

function updatePropertyInputValues(context, defs) {
    for (const def of defs) {
        const input = propFieldsContainer.querySelector(`[data-prop-key="${def.key}"]`);
        if (!input || document.activeElement === input) continue;
        const value = getContextPropertyValue(context, def);
        if (def.type === 'checkbox') {
            input.checked = value !== false;
        } else {
            input.value = value ?? '';
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
        propFieldsContainer.innerHTML = '';
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
        levelConfig.lastUsedColor = val;
        let changed = false;
        
        if (selectedObjects.length > 0) {
            selectedObjects.forEach(obj => {
                if (objectConfigs[obj.type] && objectConfigs[obj.type].colorable) {
                    obj.color = val;
                    changed = true;
                }
            });
        } else if (currentTool !== 'none' && objectConfigs[currentTool] && objectConfigs[currentTool].colorable) {
            changed = true;
        }
        
        if (changed) {
            draw();
        }
    });
});

propFieldsContainer.addEventListener('input', (e) => {
    const target = e.target;
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
            for (const obj of selectedObjects) {
                if (!getDefForObjectKey(obj.type, key)) continue;
                if (!isObjectEditableInCurrentLayer(obj)) continue;
                obj[key] = newValue;
                if (key === 'collison') {
                    obj.s = getSignedScaleFromCollison(obj.s || 1, newValue !== false);
                }
                changed = true;
            }
            if (changed) draw();
        }
    });
});

// Initial draw
draw();


