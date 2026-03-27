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
// Use explicit height factor based off original asset ratio vs desired width
let SPIKE_HEIGHT = 48;

const GOOSE_WIDTH = 45; // Approximate true-scale for goose (slightly larger)
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
const exportBtn = document.getElementById('export-btn');

// Toggle panel
togglePanelBtn.addEventListener('click', () => {
    rightPanel.classList.toggle('closed');
    togglePanelBtn.textContent = rightPanel.classList.contains('closed') ? '◀' : '▶';
});

// Keyboard Interaction
window.addEventListener('keydown', (e) => {
    // Duplicate selected objects (Ctrl+D)
    if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault(); // Prevent browser bookmark dialog
        if (currentTool === 'none' && selectedObjects.length > 0) {
            const duplicates = selectedObjects
                .filter(obj => obj.type !== 'finishLine')
                .map(obj => ({
                    ...obj,
                    x: obj.x + 24, // Shift right
                    y: obj.y - 24  // Shift up
                }));
            if (duplicates.length > 0) {
                objects.push(...duplicates);
                selectedObjects = duplicates;
                draw();
            }
        }
        return;
    }

    // Delete selected objects
    if (e.key === 'Backspace' || e.key === 'Delete') {
        if (currentTool === 'none' && selectedObjects.length > 0) {
            objects = objects.filter(obj => !selectedObjects.includes(obj));
            selectedObjects = [];
            draw();
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
        } else if (currentTool !== 'none') {
            const currentAngle = previewRotation;
            let newAngle;
            if (snapAmount > 0) {
                newAngle = Math.floor(currentAngle / 45) * 45 + 45;
            } else {
                newAngle = Math.ceil(currentAngle / 45) * 45 - 45;
            }
            previewRotation = (newAngle + 360) % 360;
            draw();
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
        if (currentTool !== 'none') {
            isTiling = true;
            tileAnchor = { x: gameX, y: gameY };
            tiledLocations.clear();
            tiledLocations.add("0,0");

            objects.push({
                type: currentTool,
                x: Number(gameX.toFixed(2)),
                y: Number(gameY.toFixed(2)),
                rotation: previewRotation,
                s: previewScale,
                color: (objectConfigs[currentTool] && objectConfigs[currentTool].colorable) ? levelConfig.lastUsedColor : undefined
            });
            draw();
        } else if (currentTool === 'none') {
            let clickedObj = getObjectAt(gameX, gameY);
            if (clickedObj) {
                if (!selectedObjects.includes(clickedObj)) {
                    selectedObjects = [clickedObj];
                }
                isDraggingObjects = true;
                lastDrag = { x: gameX, y: gameY };
            } else {
                selectedObjects = [];
                isBoxSelecting = true;
                selectionBoxStart = { x: gameX, y: gameY };
                selectionBoxEnd = { x: gameX, y: gameY };
            }
            draw();
        }
    } else if (e.button === 2) { // Right click
        // Remove object
        let clickedIndex = getObjectIndexAt(gameX, gameY);
        if (clickedIndex !== -1) {
            const deletedObj = objects[clickedIndex];
            objects.splice(clickedIndex, 1);
            selectedObjects = selectedObjects.filter(o => o !== deletedObj);
            draw();
        }
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

    if (isTiling) {
        const dims = getToolDimensions(currentTool);
        const rad = previewRotation * Math.PI / 180;
        
        // Unrotated offset from anchor
        const dx = gameX - tileAnchor.x;
        const dy = gameY - tileAnchor.y;
        
        // Rotate dx, dy to local axes of the blocks
        const localX = dx * Math.cos(-rad) - dy * Math.sin(-rad);
        const localY = dx * Math.sin(-rad) + dy * Math.cos(-rad);
        
        const gridX = Math.round(localX / (dims.w * previewScale));
        const gridY = Math.round(localY / (dims.h * previewScale));
        const locId = `${gridX},${gridY}`;

        if (!tiledLocations.has(locId)) {
            tiledLocations.add(locId);
            
            // Convert local grid coordinates back to world space
            const worldX = tileAnchor.x + (gridX * dims.w * previewScale * Math.cos(rad) - gridY * dims.h * previewScale * Math.sin(rad));
            const worldY = tileAnchor.y + (gridX * dims.w * previewScale * Math.sin(rad) + gridY * dims.h * previewScale * Math.cos(rad));
            
            objects.push({
                type: currentTool,
                x: Number(worldX.toFixed(2)),
                y: Number(worldY.toFixed(2)),
                rotation: previewRotation,
                s: previewScale,
                color: (objectConfigs[currentTool] && objectConfigs[currentTool].colorable) ? levelConfig.lastUsedColor : undefined
            });
        }
    } else if (isDraggingObjects) {
        const dx = gameX - lastDrag.x;
        const dy = gameY - lastDrag.y;
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
        if (isTiling) {
            isTiling = false;
        }
        if (isDraggingObjects) {
            selectedObjects.forEach(obj => {
                obj.x = Number(obj.x.toFixed(2));
                obj.y = Number(obj.y.toFixed(2));
            });
        }
        isDraggingObjects = false;
        isBoxSelecting = false;
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
            selectedObjects.forEach(obj => {
                if (obj.type === 'finishLine') return;
                obj.s = Math.max(0.1, (obj.s || 1) + amount);
                obj.s = Number(obj.s.toFixed(2));
            });
            draw();
        } else if (currentTool !== 'none') {
            previewScale = Math.max(0.1, previewScale + amount);
            previewScale = Number(previewScale.toFixed(2));
            draw();
        }
        return;
    }
    
    // Ctrl + Scroll to carefully rotate the preview
    if (e.ctrlKey) {
        const rotationSpeed = 5; 
        const amount = e.deltaY > 0 ? rotationSpeed : -rotationSpeed;
        
        if (currentTool === 'none' && selectedObjects.length > 0) {
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
        } else if (currentTool !== 'none') {
            previewRotation = (previewRotation + amount + 360) % 360;
            draw();
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
    levelConfig.scrollSpeed = Number(document.getElementById('set-scrollSpeed').value);
    levelConfig.gravity = Number(document.getElementById('set-gravity').value);
    levelConfig.floorEnabled = document.getElementById('set-floorEnabled').checked;
    levelConfig.antigravity = document.getElementById('set-antigravity').checked;
    levelConfig.yTrack = document.getElementById('set-yTrack').checked;
    levelConfig.gradientTopColor = document.getElementById('set-gradientTop').value;
    levelConfig.gradientBottomColor = document.getElementById('set-gradientBottom').value;
    
    // Update live bg
    if(editorContainer) editorContainer.style.background = `linear-gradient(to bottom, ${levelConfig.gradientTopColor}, ${levelConfig.gradientBottomColor})`;
    
    settingsModal.classList.add('hidden');
    draw(); // Redraw changes (like guide lines) immediately
});

// Export
exportBtn.addEventListener('click', () => {
    const levelData = {
        name: "My Custom Level",
        description: "",
        version: 1.71,
        scrollSpeed: levelConfig.scrollSpeed,
        gravity: levelConfig.gravity,
        floorEnabled: levelConfig.floorEnabled,
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
        changed = true; // Still trigger draw to tint the floating ghost preview
    }
    
    if (changed) {
        draw();
    }
});

// Initial draw
draw();


