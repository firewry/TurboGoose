const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const editorContainer = document.getElementById('editor-container');

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

// Load Assets
const gooseImg = new Image();
gooseImg.src = 'assets/default_goose.webp';

const spikeImg = new Image();
spikeImg.src = 'assets/spikes.webp';

const dirtImg = new Image();
dirtImg.src = 'assets/dirt.webp';

// Force redraw when assets load
gooseImg.onload = draw;
spikeImg.onload = draw;
dirtImg.onload = draw;

// State
let width = window.innerWidth;
let height = window.innerHeight;
let currentTool = 'none'; // 'none' or 'Spikes'
let objects = [];
let birdStart = { x: 100, y: 300 };
let finishLineObj = { type: 'finishLine', x: 500, y: 0 };

// Tool Preview State
let previewX = 0;
let previewY = 0;
let previewRotation = 0;
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
    if (tool === 'Spikes') {
        const h = (spikeImg.complete && spikeImg.naturalWidth !== 0) ? spikeImg.naturalHeight * (SPIKE_WIDTH / spikeImg.naturalWidth) : 48;
        // Tile slightly sooner to ignore transparent edges and stack vertically without gaps
        return { w: SPIKE_WIDTH * 0.82, h: h * 0.45 };
    }
    if (tool === 'floorDirt') {
        const h = (dirtImg.complete && dirtImg.naturalWidth !== 0) ? dirtImg.naturalHeight * (SPIKE_WIDTH / dirtImg.naturalWidth) : SPIKE_WIDTH;
        // Dirt only needs a tiny adjustment to close the micro gap
        return { w: SPIKE_WIDTH * 0.98, h: h * 0.98 };
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
const toolBtns = document.querySelectorAll('.tool-btn');
const exportBtn = document.getElementById('export-btn');

// Toggle panel
togglePanelBtn.addEventListener('click', () => {
    rightPanel.classList.toggle('closed');
    togglePanelBtn.textContent = rightPanel.classList.contains('closed') ? '◀' : '▶';
});

// Tool selection
toolBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
        previewRotation = 0; // Reset rotation on tool switch
        draw();
    });
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
        if (currentTool === 'Spikes' || currentTool === 'floorDirt') {
            isTiling = true;
            tileAnchor = { x: gameX, y: gameY };
            tiledLocations.clear();
            tiledLocations.add("0,0");

            objects.push({
                type: currentTool,
                x: Number(gameX.toFixed(2)),
                y: Number(gameY.toFixed(2)),
                rotation: previewRotation
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
        if (currentTool === 'none' || currentTool === 'Spikes') {
            // Remove object
            let clickedIndex = getObjectIndexAt(gameX, gameY);
            if (clickedIndex !== -1) {
                const deletedObj = objects[clickedIndex];
                objects.splice(clickedIndex, 1);
                selectedObjects = selectedObjects.filter(o => o !== deletedObj);
                draw();
            }
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
        
        const gridX = Math.round(localX / dims.w);
        const gridY = Math.round(localY / dims.h);
        const locId = `${gridX},${gridY}`;
        
        if (!tiledLocations.has(locId)) {
            tiledLocations.add(locId);
            
            // Convert local grid coordinates back to world space
            const worldX = tileAnchor.x + (gridX * dims.w * Math.cos(rad) - gridY * dims.h * Math.sin(rad));
            const worldY = tileAnchor.y + (gridX * dims.w * Math.sin(rad) + gridY * dims.h * Math.cos(rad));
            
            objects.push({
                type: currentTool,
                x: Number(worldX.toFixed(2)),
                y: Number(worldY.toFixed(2)),
                rotation: previewRotation
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
    const hitRadius = 20;
    for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (Math.abs(obj.x - x) < hitRadius && Math.abs(obj.y - y) < hitRadius) {
            return i;
        }
    }
    return -1;
}

// Drawing
function draw() {
    ctx.clearRect(0, 0, width, height);
    
    ctx.save();
    
    // Apply Camera
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

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
        if (obj.type === 'Spikes') {
            ctx.save();
            ctx.translate(obj.x, obj.y);
            ctx.rotate(obj.rotation * Math.PI / 180);
            
            if (spikeImg.complete && spikeImg.naturalWidth !== 0) {
                // Determine true height using the natural aspect ratio scaled by the known exact game unit width
                const trueSpikeHeight = spikeImg.naturalHeight * (SPIKE_WIDTH / spikeImg.naturalWidth);
                
                // The logical center for a placed tile isn't the direct center of the bounding box.
                // We use offsets based on centering the width, but treating the asset differently on Y
                ctx.drawImage(spikeImg, -SPIKE_WIDTH / 2, -trueSpikeHeight / 2, SPIKE_WIDTH, trueSpikeHeight);
                
                // Selection Highlight
                if (selectedObjects.includes(obj)) {
                    ctx.strokeStyle = '#00ffcc';
                    ctx.lineWidth = 3 / camera.zoom;
                    ctx.strokeRect(-SPIKE_WIDTH / 2 - 2, -trueSpikeHeight / 2 - 2, SPIKE_WIDTH + 4, trueSpikeHeight + 4);
                }
            } else {
                // Draw a spike (triangle) fallback
                ctx.beginPath();
                ctx.moveTo(0, -15);
                ctx.lineTo(-15, 15);
                ctx.lineTo(15, 15);
                ctx.closePath();
                ctx.fillStyle = '#ff3333';
                ctx.fill();
                ctx.strokeStyle = '#990000';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            ctx.restore();
        } else if (obj.type === 'floorDirt') {
            ctx.save();
            ctx.translate(obj.x, obj.y);
            ctx.rotate(obj.rotation * Math.PI / 180);

            if (dirtImg.complete && dirtImg.naturalWidth !== 0) {
                const trueDirtHeight = dirtImg.naturalHeight * (SPIKE_WIDTH / dirtImg.naturalWidth);
                ctx.drawImage(dirtImg, -SPIKE_WIDTH / 2, -trueDirtHeight / 2, SPIKE_WIDTH, trueDirtHeight);

                // Selection Highlight
                if (selectedObjects.includes(obj)) {
                    ctx.strokeStyle = '#00ffcc';
                    ctx.lineWidth = 3 / camera.zoom;
                    ctx.strokeRect(-SPIKE_WIDTH / 2 - 2, -trueDirtHeight / 2 - 2, SPIKE_WIDTH + 4, trueDirtHeight + 4);
                }
            } else {
                ctx.fillStyle = '#654321';
                ctx.fillRect(-SPIKE_WIDTH / 2, -SPIKE_WIDTH / 2, SPIKE_WIDTH, SPIKE_WIDTH);
                ctx.strokeStyle = '#4b3010';
                ctx.strokeRect(-SPIKE_WIDTH / 2, -SPIKE_WIDTH / 2, SPIKE_WIDTH, SPIKE_WIDTH);
            }
            ctx.restore();
        }
    });

    // Draw Preview Overlay (Ghosts)
    if (isMouseOnCanvas && currentTool !== 'none') {
        ctx.save();
        ctx.globalAlpha = 0.5; // Make the preview semi-transparent
        
        if (currentTool === 'Spikes') {
            ctx.translate(previewX, previewY);
            ctx.rotate(previewRotation * Math.PI / 180);
            
            if (spikeImg.complete && spikeImg.naturalWidth !== 0) {
                const trueSpikeHeight = spikeImg.naturalHeight * (SPIKE_WIDTH / spikeImg.naturalWidth);
                ctx.drawImage(spikeImg, -SPIKE_WIDTH / 2, -trueSpikeHeight / 2, SPIKE_WIDTH, trueSpikeHeight);
            } else {
                ctx.beginPath();
                ctx.moveTo(0, -15);
                ctx.lineTo(-15, 15);
                ctx.lineTo(15, 15);
                ctx.closePath();
                ctx.fillStyle = '#ff8888';
                ctx.fill();
            }
        } else if (currentTool === 'floorDirt') {
            ctx.translate(previewX, previewY);
            ctx.rotate(previewRotation * Math.PI / 180);

            if (dirtImg.complete && dirtImg.naturalWidth !== 0) {
                const trueDirtHeight = dirtImg.naturalHeight * (SPIKE_WIDTH / dirtImg.naturalWidth);
                ctx.drawImage(dirtImg, -SPIKE_WIDTH / 2, -trueDirtHeight / 2, SPIKE_WIDTH, trueDirtHeight);
            } else {
                ctx.fillStyle = 'rgba(139, 69, 19, 0.5)';
                ctx.fillRect(-SPIKE_WIDTH / 2, -SPIKE_WIDTH / 2, SPIKE_WIDTH, SPIKE_WIDTH);
            }
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
    
    ctx.restore(); // Restore Camera
}

// Export modal logic
const exportModal = document.getElementById('export-modal');
const jsonOutput = document.getElementById('json-output');
const closeModal = document.getElementById('close-modal');

closeModal.addEventListener('click', () => {
    exportModal.classList.add('hidden');
});

// Export
exportBtn.addEventListener('click', () => {
    const levelData = {
        name: "My Custom Level",
        description: "",
        version: 1.71,
        scrollSpeed: 2.4,
        gravity: 0.4,
        antigravity: false,
        yTrack: false,
        gradientTopColor: "#009dff",
        gradientBottomColor: "#c2ccff",
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

// Initial draw
draw();
