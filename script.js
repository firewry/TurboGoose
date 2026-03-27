const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const editorContainer = document.getElementById('editor-container');
const propPanel = document.getElementById('properties-panel');
const propColorInput = document.getElementById('prop-blockColor');

// Camera and scaling
let camera = { x: 0, y: 0, zoom: 1.5 };
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
function drawTintedImage(ctx, img, color, x, y, width, height) {
    if (_tintCanvas.width !== Math.max(1, width)) _tintCanvas.width = width;
    if (_tintCanvas.height !== Math.max(1, height)) _tintCanvas.height = height;

    _tintCtx.clearRect(0, 0, width, height);
    _tintCtx.drawImage(img, 0, 0, width, height);

    _tintCtx.globalCompositeOperation = 'multiply';
    _tintCtx.fillStyle = color;
    _tintCtx.fillRect(0, 0, width, height);

    _tintCtx.globalCompositeOperation = 'destination-in';
    _tintCtx.drawImage(img, 0, 0, width, height);
    _tintCtx.globalCompositeOperation = 'source-over';

    ctx.drawImage(_tintCanvas, x, y, width, height);
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

        const toolbar = document.getElementById('toolbar');

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
            toolbar.appendChild(btn);
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
                if (typeof updatePropertiesPanel === 'function') updatePropertiesPanel();
                draw();
            });
        });
        
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
    previewRotation = snapshot.previewRotation ?? 0;
    previewScale = snapshot.previewScale ?? 1;

    const safeIndices = Array.isArray(snapshot.selectedIndices) ? snapshot.selectedIndices : [];
    selectedObjects = safeIndices.map(idx => objects[idx]).filter(Boolean);

    updateToolbarActiveTool();
    if (editorContainer) {
        editorContainer.style.background = `linear-gradient(to bottom, ${levelConfig.gradientTopColor}, ${levelConfig.gradientBottomColor})`;
    }

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

function endUndoBatch() {
    if (!pendingUndoSnapshot) return;
    if (pendingUndoDirty) {
        pushUndoSnapshot(pendingUndoSnapshot);
    }
    pendingUndoSnapshot = null;
    pendingUndoDirty = false;
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
    }
}

function performUndo() {
    endUndoBatch();
    if (undoStack.length === 0) return;
    const snapshot = undoStack.pop();
    restoreSnapshot(snapshot);
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
    const hasTool = tool !== 'none' && objectConfigs[tool];
    const dims = hasTool ? getToolDimensions(tool) : { w: SPIKE_WIDTH, h: SPIKE_WIDTH };
    const scale = hasTool ? previewScale : 1;
    const rad = (hasTool ? previewRotation : 0) * Math.PI / 180;
    return { dims, scale, rad };
}

function getDeleteTilingMetrics() {
    const hasTool = deleteBrushTool !== 'none' && objectConfigs[deleteBrushTool];
    const dims = hasTool ? getToolDimensions(deleteBrushTool) : { w: SPIKE_WIDTH, h: SPIKE_WIDTH };
    const scale = hasTool ? deleteBrushScale : 1;
    return { dims, scale };
}

function getObjectBounds(obj) {
    const config = objectConfigs[obj.type];
    const dims = config ? getToolDimensions(obj.type) : { w: SPIKE_WIDTH, h: SPIKE_WIDTH };
    const scale = obj.s || 1;
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
    if (currentTool === 'none' || currentTool === 'lasso') return false;
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
    const baseScale = previewScale || 1;
    const baseW = Math.max(1, dims.w * baseScale);
    const baseH = Math.max(1, dims.h * baseScale);
    const minDim = Math.max(1, Math.min(baseW, baseH));
    const bounds = getPolygonBounds(lassoPolygon);
    const maxDepth = 6;
    const rootSquare = Math.max(8, minDim * 1.25);
    const adaptiveSquares = collectAdaptiveSquaresForPolygon(lassoPolygon, rootSquare, maxDepth);

    adaptiveSquares.sort((a, b) => {
        const aPriority = a.cls === 'intersect' ? 0 : 1;
        const bPriority = b.cls === 'intersect' ? 0 : 1;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return b.size - a.size;
    });

    const placedKeys = new Set();
    const maxObjects = 45000;

    const placeSquare = (square, baseRotation) => {
        if (objects.length >= maxObjects) return;

        const center = { x: square.cx, y: square.cy };
        const targetScale = square.size / Math.max(1, dims.w);
        const scaleCandidates = [
            targetScale * 1.04,
            targetScale,
            targetScale * 0.98,
            targetScale * 0.95,
            targetScale * 0.92,
            targetScale * 0.88,
            targetScale * 0.84,
            targetScale * 0.8,
            targetScale * 0.76,
            targetScale * 0.72,
            targetScale * 0.68,
            targetScale * 0.64,
            targetScale * 0.6
        ].map(value => clamp(value, baseScale * 0.55, baseScale * 1.2));

        const candidateRotations = [
            snapAngleDeg(baseRotation, 1),
            snapAngleDeg(baseRotation + 2, 1),
            snapAngleDeg(baseRotation - 2, 1),
            previewRotation
        ];

        for (const rotation of candidateRotations) {
            const rot = snapAngleDeg(rotation, 1);
            const key = `${Math.round(center.x * 10)},${Math.round(center.y * 10)},${Math.round(square.size * 10)},${Math.round(rot * 10)}`;
            if (placedKeys.has(key)) continue;
            for (const scale of scaleCandidates) {
                const tileW = dims.w * scale;
                const tileH = dims.h * scale;
                if (!isRotatedRectInsidePolygon(center.x, center.y, tileW, tileH, rot, lassoPolygon)) continue;

                objects.push({
                    type: currentTool,
                    x: Number(center.x.toFixed(2)),
                    y: Number(center.y.toFixed(2)),
                    rotation: Number(rot.toFixed(2)),
                    s: Number(scale.toFixed(3)),
                    color: (objectConfigs[currentTool] && objectConfigs[currentTool].colorable) ? levelConfig.lastUsedColor : undefined
                });
                markUndoDirty();
                placedKeys.add(key);
                return;
            }
        }
    };

    for (const square of adaptiveSquares) {
        const near = getNearestBoundarySample({ x: square.cx, y: square.cy }, lassoPolygon);
        const rotation = square.cls === 'inside'
            ? (previewRotation + normalizeAngleDeg(near.angleDeg - previewRotation) * 0.22)
            : near.angleDeg;
        placeSquare(square, rotation);
    }

    const edgeSpacing = Math.max(4, minDim * 0.22);
    const edgeSize = Math.max(3, minDim * 0.6);
    for (let i = 0; i < lassoPolygon.length; i++) {
        const a = lassoPolygon[i];
        const b = lassoPolygon[(i + 1) % lassoPolygon.length];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        if (length < 1) continue;

        const tangent = snapAngleDeg(Math.atan2(dy, dx) * 180 / Math.PI, 1);
        const nx = -dy / length;
        const ny = dx / length;

        const testA = { x: a.x + nx * 6, y: a.y + ny * 6 };
        const testB = { x: a.x - nx * 6, y: a.y - ny * 6 };
        let inwardX = nx;
        let inwardY = ny;
        if (pointInPolygonInclusive(testB, lassoPolygon) && !pointInPolygonInclusive(testA, lassoPolygon)) {
            inwardX = -nx;
            inwardY = -ny;
        }

        const steps = Math.max(1, Math.ceil(length / edgeSpacing));
        for (let step = 0; step <= steps; step++) {
            const t = step / steps;
            const px = a.x + dx * t;
            const py = a.y + dy * t;
            for (const inset of [0.08, 0.22, 0.36]) {
                const cx = px + inwardX * edgeSize * inset;
                const cy = py + inwardY * edgeSize * inset;
                if (!pointInPolygonInclusive({ x: cx, y: cy }, lassoPolygon)) continue;
                placeSquare({ cx, cy, size: edgeSize, cls: 'intersect' }, tangent);
            }
        }
    }

    const closureStep = Math.max(2, minDim * 0.12);
    const closureSquare = Math.max(3, minDim * 0.24);

    for (let y = bounds.minY; y <= bounds.maxY; y += closureStep) {
        for (let x = bounds.minX; x <= bounds.maxX; x += closureStep) {
            const p = { x, y };
            if (!pointInPolygonInclusive(p, lassoPolygon)) continue;

            let covered = false;
            for (let i = objects.length - 1; i >= 0; i--) {
                const obj = objects[i];
                if (obj.type !== currentTool) continue;
                const scale = obj.s || 1;
                if (pointInRotatedRect(p, obj.x, obj.y, dims.w * scale, dims.h * scale, obj.rotation || 0)) {
                    covered = true;
                    break;
                }
            }
            if (covered) continue;

            const near = getNearestBoundarySample(p, lassoPolygon);
            placeSquare({ cx: x, cy: y, size: closureSquare, cls: 'intersect' }, near.angleDeg);
        }
    }
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
    const obj = {
        type: currentTool,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2)),
        rotation: previewRotation,
        s: previewScale,
        color: (objectConfigs[currentTool] && objectConfigs[currentTool].colorable) ? levelConfig.lastUsedColor : undefined
    };
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

// Keyboard Interaction
window.addEventListener('keydown', (e) => {
    // Undo (Ctrl+Z)
    if (e.ctrlKey && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        performUndo();
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
    const gameX = (e.clientX - rect.left - camera.x) / camera.zoom;
    const gameY = (e.clientY - rect.top - camera.y) / camera.zoom;

    if (e.button === 0) { // Left click
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
    const gameX = (e.clientX - rect.left - camera.x) / camera.zoom;
    const gameY = (e.clientY - rect.top - camera.y) / camera.zoom;

    if (isDrawingLasso) {
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
        
        selectedObjects = objects.filter(obj => obj.x >= minX && obj.x <= maxX && obj.y >= minY && obj.y <= maxY);
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
        const amount = e.deltaY > 0 ? -scaleSpeed : scaleSpeed;

        if (currentTool === 'none' && selectedObjects.length > 0) {
            runUndoableAction(() => {
                selectedObjects.forEach(obj => {
                    if (obj.type === 'finishLine') return;
                    obj.s = Math.max(0.1, (obj.s || 1) + amount);
                    obj.s = Number(obj.s.toFixed(2));
                });
                draw();
            });
        } else if (currentTool !== 'none') {
            runUndoableAction(() => {
                previewScale = Math.max(0.1, previewScale + amount);
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
        const scale = obj.s || 1;
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
        ctx.clearRect(0, 0, width, height);

        ctx.save();

        // Apply Camera
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

// Draw bird (Goose)
    ctx.save();
    
    // The goose's true start position in the engine requires a visual offset compared to generic blocks
    // Based on center overlap measurements: Goose anchor is positioned roughly on the bottom-center of its sprite
    // while generic objects are centered.
    const GOOSE_OFFSET_X = 18; // Nudge right exactly to align with game screenshot
    const GOOSE_OFFSET_Y = -12; // Nudge up to rest exactly where the game anchors it
    
    ctx.translate(birdStart.x + GOOSE_OFFSET_X, birdStart.y + GOOSE_OFFSET_Y);
    
    // Flip goose horizontally
    ctx.scale(-1, 1);

    if (gooseImg.complete && gooseImg.naturalWidth !== 0) {
        // Draw goose centered
        ctx.drawImage(gooseImg, -GOOSE_WIDTH / 2, -GOOSE_HEIGHT / 2, GOOSE_WIDTH, GOOSE_HEIGHT);
    } else {
        ctx.font = '30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🦆', 0, 0);
    }
    ctx.restore();

    // Draw objects (render in array order so newest objects appear on top)
    const sortedObjects = objects;

    sortedObjects.forEach(obj => {
        const config = objectConfigs[obj.type];
        if (config) {
            ctx.save();
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
                ctx.lineWidth = 3 / camera.zoom;
                ctx.strokeRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
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
        bullets: [],
        bulletTriggers: [],
        layers: { currentLayer: 1, maxLayers: 3 },
        genericObjects: objects.map(obj => {
            const exportedObj = {
                type: obj.type,
                x: obj.x,
                y: obj.y
            };
            if (obj.rotation) {
                // Convert degrees to radians and round to 3 decimal places
                exportedObj.a = Number((obj.rotation * Math.PI / 180).toFixed(3));
            }
            if (obj.s && obj.s !== 1) {
                exportedObj.s = obj.s;
            }
            if (obj.color) {
                exportedObj.color = obj.color;
            }
            return exportedObj;
        }),
        finishLineX: finishLineObj.x,
        completionRequirement: { type: "crossFinishLine" }
    };

    const dataStr = JSON.stringify(levelData, null, 2);
    jsonOutput.value = dataStr;
    exportModal.classList.remove('hidden');
    jsonOutput.select();
});

// Properties Panel Logic

function updatePropertiesPanel() {
    const isPlacing = currentTool !== 'none' && objectConfigs[currentTool] && objectConfigs[currentTool].colorable;
    const firstColorObj = selectedObjects.find(obj => objectConfigs[obj.type] && objectConfigs[obj.type].colorable);
    const isSelectingColorItem = !!firstColorObj;

    if (isPlacing || isSelectingColorItem) {
        propPanel.classList.remove('closed');
        
        // Update color preview without disrupting active user input
        if (document.activeElement !== propColorInput) {
            if (isSelectingColorItem) {
                propColorInput.value = firstColorObj.color || levelConfig.lastUsedColor;
            } else {
                propColorInput.value = levelConfig.lastUsedColor;
            }
        }
    } else {
        propPanel.classList.add('closed');
    }
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

// Initial draw
draw();


