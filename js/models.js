import * as THREE from 'three';

const WOOD_COLOR = 0x8B6914;
const WOOD_LIGHT = 0xA0824A;
const WOOD_DARK = 0x5C4010;
const METAL_COLOR = 0x808080;
const METAL_DARK = 0x505050;
const GLASS_COLOR = 0xaaddff;
const WHITE = 0xe8e8e8;
const WALL_COLOR = 0xd5cfc0;
const FLOOR_COLOR = 0x9e9080;

function woodMaterial(color = WOOD_COLOR) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.7,
        metalness: 0.0,
    });
}

function metalMaterial(color = METAL_COLOR) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.3,
        metalness: 0.8,
    });
}

function wallMaterial(color = WALL_COLOR) {
    return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.9,
        metalness: 0.0,
    });
}

function glassMaterial() {
    return new THREE.MeshStandardMaterial({
        color: GLASS_COLOR,
        roughness: 0.05,
        metalness: 0.1,
        transparent: true,
        opacity: 0.3,
    });
}

function makeBox(w, h, d, material) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, material);
    return mesh;
}

// ============ CABINET ============
export function createCabinet(params = {}) {
    const {
        width = 0.8,
        height = 1.0,
        depth = 0.5,
        shelves = 2,
        doors = 2,
        color = WOOD_COLOR
    } = params;

    const group = new THREE.Group();
    const mat = woodMaterial(color);
    const matDark = woodMaterial(new THREE.Color(color).offsetHSL(0, 0, -0.1).getHex());
    const t = 0.02; // thickness

    // Back panel
    const back = makeBox(width, height, t, mat);
    back.position.set(0, height / 2, -depth / 2 + t / 2);
    group.add(back);

    // Sides
    const sideL = makeBox(t, height, depth, mat);
    sideL.position.set(-width / 2 + t / 2, height / 2, 0);
    group.add(sideL);

    const sideR = makeBox(t, height, depth, mat);
    sideR.position.set(width / 2 - t / 2, height / 2, 0);
    group.add(sideR);

    // Top
    const top = makeBox(width, t, depth, mat);
    top.position.set(0, height - t / 2, 0);
    group.add(top);

    // Bottom
    const bottom = makeBox(width, t, depth, mat);
    bottom.position.set(0, t / 2, 0);
    group.add(bottom);

    // Shelves
    const innerH = height - 2 * t;
    for (let i = 1; i <= shelves; i++) {
        const y = t + (innerH / (shelves + 1)) * i;
        const shelf = makeBox(width - 2 * t, t * 0.8, depth - t, mat);
        shelf.position.set(0, y, t / 2);
        group.add(shelf);
    }

    // Doors
    const doorWidth = (width - 2 * t) / doors;
    for (let i = 0; i < doors; i++) {
        const door = makeBox(doorWidth - 0.005, height - 2 * t - 0.005, t, matDark);
        const x = -width / 2 + t + doorWidth / 2 + i * doorWidth;
        door.position.set(x, height / 2, depth / 2 - t / 2);
        group.add(door);

        // Handle
        const handle = makeBox(0.01, 0.06, 0.02, metalMaterial());
        handle.position.set(x + (i < doors / 2 ? doorWidth / 2 - 0.04 : -doorWidth / 2 + 0.04), height / 2, depth / 2 + 0.005);
        group.add(handle);
    }

    group.userData = {
        type: 'cabinet',
        name: 'Cabinet',
        params: { width, height, depth, shelves, doors, color },
        icon: 'kitchen'
    };

    return group;
}

// ============ LOCKER ============
export function createLocker(params = {}) {
    const {
        width = 0.4,
        height = 1.8,
        depth = 0.45,
        rows = 3,
        columns = 2,
        color = METAL_COLOR
    } = params;

    const group = new THREE.Group();
    const mat = metalMaterial(color);
    const t = 0.015;

    const totalW = width * columns;
    const cellH = height / rows;

    // Outer shell
    for (let c = 0; c <= columns; c++) {
        const x = -totalW / 2 + c * width;
        const side = makeBox(t, height, depth, mat);
        side.position.set(x, height / 2, 0);
        group.add(side);
    }

    // Top & bottom
    const topPlate = makeBox(totalW, t, depth, mat);
    topPlate.position.set(0, height - t / 2, 0);
    group.add(topPlate);

    const bottomPlate = makeBox(totalW, t, depth, mat);
    bottomPlate.position.set(0, t / 2, 0);
    group.add(bottomPlate);

    // Horizontal dividers & doors
    const doorMat = metalMaterial(new THREE.Color(color).offsetHSL(0, 0, -0.05).getHex());
    for (let r = 0; r < rows; r++) {
        if (r > 0) {
            const divider = makeBox(totalW, t, depth, mat);
            divider.position.set(0, r * cellH, 0);
            group.add(divider);
        }
        for (let c = 0; c < columns; c++) {
            const door = makeBox(width - t - 0.005, cellH - t - 0.005, t, doorMat);
            const x = -totalW / 2 + width / 2 + c * width;
            const y = r * cellH + cellH / 2;
            door.position.set(x, y, depth / 2 - t / 2);
            group.add(door);

            // Vent slits
            for (let s = 0; s < 3; s++) {
                const slit = makeBox(width * 0.4, 0.003, t + 0.001, metalMaterial(METAL_DARK));
                slit.position.set(x, y - 0.03 + s * 0.025, depth / 2 - t / 2 + 0.001);
                group.add(slit);
            }
        }
    }

    // Back panel
    const backPanel = makeBox(totalW, height, t, mat);
    backPanel.position.set(0, height / 2, -depth / 2 + t / 2);
    group.add(backPanel);

    group.userData = {
        type: 'locker',
        name: 'Locker',
        params: { width, height, depth, rows, columns, color },
        icon: 'door_sliding'
    };

    return group;
}

// ============ SHELF UNIT ============
export function createShelf(params = {}) {
    const {
        width = 1.0,
        height = 1.5,
        depth = 0.35,
        shelves = 4,
        color = WOOD_COLOR
    } = params;

    const group = new THREE.Group();
    const mat = woodMaterial(color);
    const t = 0.02;

    // Sides
    const sideL = makeBox(t, height, depth, mat);
    sideL.position.set(-width / 2, height / 2, 0);
    group.add(sideL);

    const sideR = makeBox(t, height, depth, mat);
    sideR.position.set(width / 2, height / 2, 0);
    group.add(sideR);

    // Back
    const back = makeBox(width, height, t * 0.5, mat);
    back.position.set(0, height / 2, -depth / 2 + t * 0.25);
    group.add(back);

    // Shelves (including top and bottom)
    for (let i = 0; i <= shelves; i++) {
        const y = (height / shelves) * i;
        const shelf = makeBox(width, t, depth, mat);
        shelf.position.set(0, y + t / 2, 0);
        group.add(shelf);
    }

    group.userData = {
        type: 'shelf',
        name: 'Shelf Unit',
        params: { width, height, depth, shelves, color },
        icon: 'shelves'
    };

    return group;
}

// ============ DRAWER UNIT ============
export function createDrawerUnit(params = {}) {
    const {
        width = 0.6,
        height = 0.8,
        depth = 0.5,
        drawers = 4,
        color = WOOD_COLOR
    } = params;

    const group = new THREE.Group();
    const mat = woodMaterial(color);
    const matFront = woodMaterial(new THREE.Color(color).offsetHSL(0, 0, -0.08).getHex());
    const t = 0.02;

    // Shell: back, sides, top, bottom
    const back = makeBox(width, height, t, mat);
    back.position.set(0, height / 2, -depth / 2 + t / 2);
    group.add(back);

    for (const side of [-1, 1]) {
        const s = makeBox(t, height, depth, mat);
        s.position.set(side * (width / 2 - t / 2), height / 2, 0);
        group.add(s);
    }

    const topP = makeBox(width, t, depth, mat);
    topP.position.set(0, height - t / 2, 0);
    group.add(topP);

    const botP = makeBox(width, t, depth, mat);
    botP.position.set(0, t / 2, 0);
    group.add(botP);

    // Drawers
    const drawerH = (height - 2 * t) / drawers;
    for (let i = 0; i < drawers; i++) {
        const y = t + drawerH / 2 + i * drawerH;
        const front = makeBox(width - 2 * t - 0.004, drawerH - 0.006, t, matFront);
        front.position.set(0, y, depth / 2 - t / 2);
        group.add(front);

        const handle = makeBox(0.08, 0.015, 0.015, metalMaterial());
        handle.position.set(0, y, depth / 2 + 0.005);
        group.add(handle);
    }

    group.userData = {
        type: 'drawer-unit',
        name: 'Drawer Unit',
        params: { width, height, depth, drawers, color },
        icon: 'inbox'
    };

    return group;
}

// ============ DESK ============
export function createDesk(params = {}) {
    const {
        width = 1.2,
        height = 0.75,
        depth = 0.6,
        color = WOOD_COLOR
    } = params;

    const group = new THREE.Group();
    const mat = woodMaterial(color);
    const legMat = metalMaterial();
    const t = 0.03;
    const legT = 0.04;

    // Top surface
    const top = makeBox(width, t, depth, mat);
    top.position.set(0, height - t / 2, 0);
    group.add(top);

    // Legs
    const legH = height - t;
    const positions = [
        [-width / 2 + legT, legH / 2, -depth / 2 + legT],
        [width / 2 - legT, legH / 2, -depth / 2 + legT],
        [-width / 2 + legT, legH / 2, depth / 2 - legT],
        [width / 2 - legT, legH / 2, depth / 2 - legT],
    ];
    positions.forEach(([x, y, z]) => {
        const leg = makeBox(legT, legH, legT, legMat);
        leg.position.set(x, y, z);
        group.add(leg);
    });

    // Cross bar
    const bar = makeBox(width - legT * 2, legT * 0.5, legT * 0.5, legMat);
    bar.position.set(0, 0.1, -depth / 2 + legT);
    group.add(bar);

    group.userData = {
        type: 'desk',
        name: 'Desk',
        params: { width, height, depth, color },
        icon: 'desk'
    };

    return group;
}

// ============ TABLE ============
export function createTable(params = {}) {
    const {
        width = 1.4,
        height = 0.75,
        depth = 0.8,
        color = WOOD_COLOR
    } = params;

    const group = new THREE.Group();
    const mat = woodMaterial(color);
    const t = 0.035;
    const legT = 0.05;

    // Top
    const top = makeBox(width, t, depth, mat);
    top.position.set(0, height - t / 2, 0);
    group.add(top);

    // Legs
    const legH = height - t;
    const offX = width / 2 - 0.08;
    const offZ = depth / 2 - 0.08;
    [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz]) => {
        const leg = makeBox(legT, legH, legT, mat);
        leg.position.set(sx * offX, legH / 2, sz * offZ);
        group.add(leg);
    });

    // Apron (rails under top)
    const apronH = 0.08;
    const apronT = 0.02;
    // Front & back
    for (const z of [-offZ, offZ]) {
        const apron = makeBox(width - 0.12, apronH, apronT, mat);
        apron.position.set(0, height - t - apronH / 2, z);
        group.add(apron);
    }
    // Sides
    for (const x of [-offX, offX]) {
        const apron = makeBox(apronT, apronH, depth - 0.12, mat);
        apron.position.set(x, height - t - apronH / 2, 0);
        group.add(apron);
    }

    group.userData = {
        type: 'table',
        name: 'Table',
        params: { width, height, depth, color },
        icon: 'table_restaurant'
    };

    return group;
}

// ============ BOOKCASE ============
export function createBookcase(params = {}) {
    const {
        width = 0.9,
        height = 1.8,
        depth = 0.3,
        shelves = 5,
        color = WOOD_COLOR
    } = params;

    const group = new THREE.Group();
    const mat = woodMaterial(color);
    const t = 0.02;

    // Sides
    for (const side of [-1, 1]) {
        const s = makeBox(t, height, depth, mat);
        s.position.set(side * (width / 2 - t / 2), height / 2, 0);
        group.add(s);
    }

    // Back
    const back = makeBox(width, height, t * 0.5, mat);
    back.position.set(0, height / 2, -depth / 2 + t * 0.25);
    group.add(back);

    // Shelves + top
    for (let i = 0; i <= shelves; i++) {
        const y = (height / shelves) * i;
        const shelf = makeBox(width - 2 * t, t, depth, mat);
        shelf.position.set(0, y + t / 2, 0);
        group.add(shelf);
    }

    // Top cap
    const topCap = makeBox(width + 0.02, t, depth + 0.02, mat);
    topCap.position.set(0, height + t / 2, 0);
    group.add(topCap);

    group.userData = {
        type: 'bookcase',
        name: 'Bookcase',
        params: { width, height, depth, shelves, color },
        icon: 'auto_stories'
    };

    return group;
}

// ============ WARDROBE ============
export function createWardrobe(params = {}) {
    const {
        width = 1.2,
        height = 2.0,
        depth = 0.6,
        doors = 2,
        color = WOOD_COLOR
    } = params;

    const group = new THREE.Group();
    const mat = woodMaterial(color);
    const matDark = woodMaterial(new THREE.Color(color).offsetHSL(0, 0, -0.1).getHex());
    const t = 0.02;

    // Shell
    const back = makeBox(width, height, t, mat);
    back.position.set(0, height / 2, -depth / 2 + t / 2);
    group.add(back);

    for (const side of [-1, 1]) {
        const s = makeBox(t, height, depth, mat);
        s.position.set(side * (width / 2 - t / 2), height / 2, 0);
        group.add(s);
    }

    const topP = makeBox(width, t, depth, mat);
    topP.position.set(0, height - t / 2, 0);
    group.add(topP);

    const botP = makeBox(width, t, depth, mat);
    botP.position.set(0, t / 2, 0);
    group.add(botP);

    // Internal shelf near top
    const topShelf = makeBox(width - 2 * t, t, depth - t, mat);
    topShelf.position.set(0, height * 0.82, 0);
    group.add(topShelf);

    // Hanging rail
    const railGeo = new THREE.CylinderGeometry(0.008, 0.008, width - 2 * t - 0.04, 8);
    const rail = new THREE.Mesh(railGeo, metalMaterial());
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, height * 0.78, 0);
    group.add(rail);

    // Doors
    const doorW = (width - 2 * t) / doors;
    for (let i = 0; i < doors; i++) {
        const door = makeBox(doorW - 0.005, height - 2 * t - 0.005, t, matDark);
        const x = -width / 2 + t + doorW / 2 + i * doorW;
        door.position.set(x, height / 2, depth / 2 - t / 2);
        group.add(door);

        const handle = makeBox(0.012, 0.12, 0.02, metalMaterial());
        handle.position.set(
            x + (i < doors / 2 ? doorW / 2 - 0.04 : -doorW / 2 + 0.04),
            height / 2,
            depth / 2 + 0.005
        );
        group.add(handle);
    }

    group.userData = {
        type: 'wardrobe',
        name: 'Wardrobe',
        params: { width, height, depth, doors, color },
        icon: 'checkroom'
    };

    return group;
}

// ============ ROOM ============
export function createRoom(params = {}) {
    const {
        width = 4.0,
        height = 2.6,
        depth = 4.0,
        wallColor = WALL_COLOR,
        floorColor = FLOOR_COLOR
    } = params;

    const group = new THREE.Group();
    const wMat = wallMaterial(wallColor);
    const fMat = wallMaterial(floorColor);
    const t = 0.08;

    // Floor
    const floor = makeBox(width, t, depth, fMat);
    floor.position.set(0, t / 2, 0);
    group.add(floor);

    // Back wall
    const backW = makeBox(width, height, t, wMat);
    backW.position.set(0, height / 2 + t, -depth / 2 + t / 2);
    group.add(backW);

    // Left wall
    const leftW = makeBox(t, height, depth, wMat);
    leftW.position.set(-width / 2 + t / 2, height / 2 + t, 0);
    group.add(leftW);

    // Right wall
    const rightW = makeBox(t, height, depth, wMat);
    rightW.position.set(width / 2 - t / 2, height / 2 + t, 0);
    group.add(rightW);

    group.userData = {
        type: 'room',
        name: 'Room',
        params: { width, height, depth, wallColor, floorColor },
        icon: 'meeting_room'
    };

    return group;
}

// ============ WALL ============
export function createWall(params = {}) {
    const {
        width = 3.0,
        height = 2.6,
        thickness = 0.12,
        color = WALL_COLOR
    } = params;

    const group = new THREE.Group();
    const mat = wallMaterial(color);

    const wall = makeBox(width, height, thickness, mat);
    wall.position.set(0, height / 2, 0);
    group.add(wall);

    group.userData = {
        type: 'wall',
        name: 'Wall',
        params: { width, height, thickness, color },
        icon: 'fence'
    };

    return group;
}

// ============ FLOOR ============
export function createFloor(params = {}) {
    const {
        width = 4.0,
        depth = 4.0,
        color = FLOOR_COLOR
    } = params;

    const group = new THREE.Group();
    const mat = wallMaterial(color);

    const floor = makeBox(width, 0.05, depth, mat);
    floor.position.set(0, 0.025, 0);
    group.add(floor);

    group.userData = {
        type: 'floor',
        name: 'Floor',
        params: { width, depth, color },
        icon: 'square'
    };

    return group;
}

// ============ DOOR FRAME ============
export function createDoorFrame(params = {}) {
    const {
        width = 0.9,
        height = 2.1,
        frameWidth = 0.08,
        color = WOOD_COLOR
    } = params;

    const group = new THREE.Group();
    const mat = woodMaterial(color);
    const d = 0.06;

    // Left frame
    const left = makeBox(frameWidth, height, d, mat);
    left.position.set(-width / 2 - frameWidth / 2, height / 2, 0);
    group.add(left);

    // Right frame
    const right = makeBox(frameWidth, height, d, mat);
    right.position.set(width / 2 + frameWidth / 2, height / 2, 0);
    group.add(right);

    // Top frame
    const top = makeBox(width + frameWidth * 2, frameWidth, d, mat);
    top.position.set(0, height + frameWidth / 2, 0);
    group.add(top);

    // Door panel
    const doorMat = woodMaterial(new THREE.Color(color).offsetHSL(0, 0, -0.1).getHex());
    const door = makeBox(width - 0.01, height - 0.01, 0.035, doorMat);
    door.position.set(0, height / 2, 0);
    group.add(door);

    // Handle
    const handle = makeBox(0.015, 0.04, 0.03, metalMaterial());
    handle.position.set(width / 2 - 0.08, height * 0.47, 0.03);
    group.add(handle);

    group.userData = {
        type: 'door-frame',
        name: 'Door',
        params: { width, height, frameWidth, color },
        icon: 'sensor_door'
    };

    return group;
}

// ============ PRIMITIVES ============
export function createBox(params = {}) {
    const {
        width = 0.5,
        height = 0.5,
        depth = 0.5,
        color = 0x6688aa
    } = params;

    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = height / 2;

    mesh.userData = {
        type: 'box',
        name: 'Box',
        params: { width, height, depth, color },
        icon: 'check_box_outline_blank'
    };

    return mesh;
}

export function createCylinder(params = {}) {
    const {
        radius = 0.3,
        height = 0.8,
        color = 0x6688aa
    } = params;

    const geo = new THREE.CylinderGeometry(radius, radius, height, 32);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = height / 2;

    mesh.userData = {
        type: 'cylinder',
        name: 'Cylinder',
        params: { radius, height, color },
        icon: 'radio_button_unchecked'
    };

    return mesh;
}

export function createSphere(params = {}) {
    const {
        radius = 0.3,
        color = 0x6688aa
    } = params;

    const geo = new THREE.SphereGeometry(radius, 32, 24);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = radius;

    mesh.userData = {
        type: 'sphere',
        name: 'Sphere',
        params: { radius, color },
        icon: 'circle'
    };

    return mesh;
}

export function createPlane(params = {}) {
    const {
        width = 1.0,
        height = 1.0,
        color = 0x6688aa
    } = params;

    const geo = new THREE.PlaneGeometry(width, height);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.001;

    mesh.userData = {
        type: 'plane',
        name: 'Plane',
        params: { width, height, color },
        icon: 'crop_landscape'
    };

    return mesh;
}

// ============ FACTORY ============
const creators = {
    'cabinet': createCabinet,
    'locker': createLocker,
    'shelf': createShelf,
    'drawer-unit': createDrawerUnit,
    'desk': createDesk,
    'table': createTable,
    'bookcase': createBookcase,
    'wardrobe': createWardrobe,
    'room': createRoom,
    'wall': createWall,
    'floor': createFloor,
    'door-frame': createDoorFrame,
    'box': createBox,
    'cylinder': createCylinder,
    'sphere': createSphere,
    'plane': createPlane,
};

export function createModel(type, params = {}) {
    const fn = creators[type];
    if (!fn) {
        console.warn('Unknown model type:', type);
        return null;
    }
    return fn(params);
}

export function getParamDefs(type) {
    const defs = {
        'cabinet': [
            { key: 'width', label: 'Width', type: 'number', min: 0.2, max: 3, step: 0.05 },
            { key: 'height', label: 'Height', type: 'number', min: 0.3, max: 3, step: 0.05 },
            { key: 'depth', label: 'Depth', type: 'number', min: 0.2, max: 1.5, step: 0.05 },
            { key: 'shelves', label: 'Shelves', type: 'int', min: 0, max: 8, step: 1 },
            { key: 'doors', label: 'Doors', type: 'int', min: 1, max: 6, step: 1 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'locker': [
            { key: 'width', label: 'Cell Width', type: 'number', min: 0.2, max: 1, step: 0.05 },
            { key: 'height', label: 'Height', type: 'number', min: 0.5, max: 2.5, step: 0.05 },
            { key: 'depth', label: 'Depth', type: 'number', min: 0.2, max: 1, step: 0.05 },
            { key: 'rows', label: 'Rows', type: 'int', min: 1, max: 8, step: 1 },
            { key: 'columns', label: 'Columns', type: 'int', min: 1, max: 6, step: 1 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'shelf': [
            { key: 'width', label: 'Width', type: 'number', min: 0.3, max: 3, step: 0.05 },
            { key: 'height', label: 'Height', type: 'number', min: 0.5, max: 3, step: 0.05 },
            { key: 'depth', label: 'Depth', type: 'number', min: 0.15, max: 1, step: 0.05 },
            { key: 'shelves', label: 'Shelves', type: 'int', min: 1, max: 10, step: 1 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'drawer-unit': [
            { key: 'width', label: 'Width', type: 'number', min: 0.3, max: 1.5, step: 0.05 },
            { key: 'height', label: 'Height', type: 'number', min: 0.3, max: 1.5, step: 0.05 },
            { key: 'depth', label: 'Depth', type: 'number', min: 0.2, max: 1, step: 0.05 },
            { key: 'drawers', label: 'Drawers', type: 'int', min: 1, max: 8, step: 1 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'desk': [
            { key: 'width', label: 'Width', type: 'number', min: 0.6, max: 3, step: 0.05 },
            { key: 'height', label: 'Height', type: 'number', min: 0.5, max: 1.2, step: 0.05 },
            { key: 'depth', label: 'Depth', type: 'number', min: 0.3, max: 1.2, step: 0.05 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'table': [
            { key: 'width', label: 'Width', type: 'number', min: 0.5, max: 3, step: 0.05 },
            { key: 'height', label: 'Height', type: 'number', min: 0.4, max: 1.2, step: 0.05 },
            { key: 'depth', label: 'Depth', type: 'number', min: 0.4, max: 2, step: 0.05 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'bookcase': [
            { key: 'width', label: 'Width', type: 'number', min: 0.4, max: 2, step: 0.05 },
            { key: 'height', label: 'Height', type: 'number', min: 0.6, max: 3, step: 0.05 },
            { key: 'depth', label: 'Depth', type: 'number', min: 0.15, max: 0.6, step: 0.05 },
            { key: 'shelves', label: 'Shelves', type: 'int', min: 2, max: 10, step: 1 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'wardrobe': [
            { key: 'width', label: 'Width', type: 'number', min: 0.6, max: 3, step: 0.05 },
            { key: 'height', label: 'Height', type: 'number', min: 1.0, max: 2.8, step: 0.05 },
            { key: 'depth', label: 'Depth', type: 'number', min: 0.3, max: 1, step: 0.05 },
            { key: 'doors', label: 'Doors', type: 'int', min: 1, max: 4, step: 1 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'room': [
            { key: 'width', label: 'Width', type: 'number', min: 1, max: 15, step: 0.1 },
            { key: 'height', label: 'Height', type: 'number', min: 2, max: 5, step: 0.1 },
            { key: 'depth', label: 'Depth', type: 'number', min: 1, max: 15, step: 0.1 },
            { key: 'wallColor', label: 'Wall Color', type: 'color' },
            { key: 'floorColor', label: 'Floor Color', type: 'color' },
        ],
        'wall': [
            { key: 'width', label: 'Width', type: 'number', min: 0.5, max: 15, step: 0.1 },
            { key: 'height', label: 'Height', type: 'number', min: 1, max: 5, step: 0.1 },
            { key: 'thickness', label: 'Thickness', type: 'number', min: 0.05, max: 0.5, step: 0.01 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'floor': [
            { key: 'width', label: 'Width', type: 'number', min: 1, max: 20, step: 0.1 },
            { key: 'depth', label: 'Depth', type: 'number', min: 1, max: 20, step: 0.1 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'door-frame': [
            { key: 'width', label: 'Width', type: 'number', min: 0.5, max: 2, step: 0.05 },
            { key: 'height', label: 'Height', type: 'number', min: 1.5, max: 3, step: 0.05 },
            { key: 'frameWidth', label: 'Frame Width', type: 'number', min: 0.03, max: 0.2, step: 0.01 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'box': [
            { key: 'width', label: 'Width', type: 'number', min: 0.05, max: 5, step: 0.05 },
            { key: 'height', label: 'Height', type: 'number', min: 0.05, max: 5, step: 0.05 },
            { key: 'depth', label: 'Depth', type: 'number', min: 0.05, max: 5, step: 0.05 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'cylinder': [
            { key: 'radius', label: 'Radius', type: 'number', min: 0.05, max: 3, step: 0.05 },
            { key: 'height', label: 'Height', type: 'number', min: 0.05, max: 5, step: 0.05 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'sphere': [
            { key: 'radius', label: 'Radius', type: 'number', min: 0.05, max: 3, step: 0.05 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
        'plane': [
            { key: 'width', label: 'Width', type: 'number', min: 0.1, max: 20, step: 0.1 },
            { key: 'height', label: 'Height', type: 'number', min: 0.1, max: 20, step: 0.1 },
            { key: 'color', label: 'Color', type: 'color' },
        ],
    };
    return defs[type] || [];
}
