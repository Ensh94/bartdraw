import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { t } from './i18n.js';

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.objects = [];
        this.selectedObject = null;
        this.selectedObjects = [];
        this.onSelectionChange = null;
        this.onObjectsChange = null;
        this.snapEnabled = false;
        this.gridVisible = true;
        this.dimensionsVisible = false;
        this.snapValue = 0.25;
        this._dimensionLabels = [];
        this.notes = [];
        this._noteIdCounter = 0;
        this.notesVisible = true;

        this._init();
    }

    _init() {
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: false,
            preserveDrawingBuffer: true
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;

        // CSS2D Renderer for dimension labels
        this.labelRenderer = new CSS2DRenderer();
        this.labelRenderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
        this.labelRenderer.domElement.style.position = 'absolute';
        this.labelRenderer.domElement.style.top = '0';
        this.labelRenderer.domElement.style.left = '0';
        this.labelRenderer.domElement.style.pointerEvents = 'none';
        this.canvas.parentElement.appendChild(this.labelRenderer.domElement);

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0a0e1a);
        this.scene.fog = new THREE.Fog(0x0a0e1a, 30, 80);

        // Camera
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
        this.camera.position.set(5, 4, 7);

        // Orbit Controls
        this.orbitControls = new OrbitControls(this.camera, this.canvas);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.08;
        this.orbitControls.target.set(0, 0.5, 0);
        this.orbitControls.minDistance = 1;
        this.orbitControls.maxDistance = 50;
        this.orbitControls.maxPolarAngle = Math.PI * 0.48;

        // Transform Controls
        this.transformControls = new TransformControls(this.camera, this.canvas);
        this.transformControls.setSpace('world');
        this.transformControls.addEventListener('dragging-changed', (e) => {
            this.orbitControls.enabled = !e.value;
            if (!e.value && this.selectedObjects.length > 1) {
                this._resetPivot();
            }
        });
        this.transformControls.addEventListener('objectChange', () => {
            if (this.selectedObjects.length > 1) {
                this._applyGroupTransform();
            } else if (this.snapEnabled) {
                const obj = this.transformControls.object;
                if (obj && this.transformControls.mode === 'translate') {
                    this._snapToObjects(obj);
                }
            }
            if (this.onSelectionChange) this.onSelectionChange(this.selectedObject);
        });
        this.scene.add(this.transformControls);

        // Selection pivot for multi-select transforms
        this._selectionPivot = new THREE.Object3D();
        this._pivotPrevPosition = new THREE.Vector3();
        this._pivotPrevQuaternion = new THREE.Quaternion();
        this._pivotPrevScale = new THREE.Vector3(1, 1, 1);
        this.scene.add(this._selectionPivot);

        // Lights
        this._setupLights();

        // Grid
        this._setupGrid();

        // Raycaster for picking
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Events — track pointer to distinguish click from drag
        this._pointerDownPos = { x: 0, y: 0 };
        this._pointerIsDown = false;
        this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
        this.canvas.addEventListener('pointerup', (e) => this._onPointerUp(e));
        window.addEventListener('resize', () => this._onResize());

        this._onResize();
        this._animate();
    }

    _setupLights() {
        // Ambient
        this.ambientLight = new THREE.AmbientLight(0x8090b0, 0.6);
        this.scene.add(this.ambientLight);

        // Hemisphere
        this.hemiLight = new THREE.HemisphereLight(0xc8d8f0, 0x2a1a0a, 0.4);
        this.scene.add(this.hemiLight);

        // Key light
        this.keyLight = new THREE.DirectionalLight(0xffeedd, 1.2);
        this.keyLight.position.set(8, 12, 6);
        this.keyLight.castShadow = true;
        this.keyLight.shadow.mapSize.set(2048, 2048);
        this.keyLight.shadow.camera.left = -15;
        this.keyLight.shadow.camera.right = 15;
        this.keyLight.shadow.camera.top = 15;
        this.keyLight.shadow.camera.bottom = -15;
        this.keyLight.shadow.camera.near = 0.1;
        this.keyLight.shadow.camera.far = 40;
        this.keyLight.shadow.bias = -0.001;
        this.scene.add(this.keyLight);

        // Fill light
        this.fillLight = new THREE.DirectionalLight(0x8899cc, 0.3);
        this.fillLight.position.set(-5, 6, -3);
        this.scene.add(this.fillLight);

        // Rim light
        this.rimLight = new THREE.DirectionalLight(0x4fc3f7, 0.2);
        this.rimLight.position.set(-3, 4, 8);
        this.scene.add(this.rimLight);
    }

    getLightSettings() {
        return {
            ambientIntensity: this.ambientLight.intensity,
            ambientColor: '#' + this.ambientLight.color.getHexString(),
            hemiIntensity: this.hemiLight.intensity,
            keyIntensity: this.keyLight.intensity,
            keyColor: '#' + this.keyLight.color.getHexString(),
            keyX: this.keyLight.position.x,
            keyY: this.keyLight.position.y,
            keyZ: this.keyLight.position.z,
            fillIntensity: this.fillLight.intensity,
            rimIntensity: this.rimLight.intensity,
            shadowsEnabled: this.keyLight.castShadow,
            exposure: this.renderer.toneMappingExposure,
        };
    }

    setLightSettings(s) {
        if (s.ambientIntensity !== undefined) this.ambientLight.intensity = s.ambientIntensity;
        if (s.ambientColor) this.ambientLight.color.set(s.ambientColor);
        if (s.hemiIntensity !== undefined) this.hemiLight.intensity = s.hemiIntensity;
        if (s.keyIntensity !== undefined) this.keyLight.intensity = s.keyIntensity;
        if (s.keyColor) this.keyLight.color.set(s.keyColor);
        if (s.keyX !== undefined) this.keyLight.position.x = s.keyX;
        if (s.keyY !== undefined) this.keyLight.position.y = s.keyY;
        if (s.keyZ !== undefined) this.keyLight.position.z = s.keyZ;
        if (s.fillIntensity !== undefined) this.fillLight.intensity = s.fillIntensity;
        if (s.rimIntensity !== undefined) this.rimLight.intensity = s.rimIntensity;
        if (s.shadowsEnabled !== undefined) {
            this.keyLight.castShadow = s.shadowsEnabled;
            this.groundPlane.receiveShadow = s.shadowsEnabled;
        }
        if (s.exposure !== undefined) this.renderer.toneMappingExposure = s.exposure;
    }

    _setupGrid() {
        this.gridHelper = new THREE.GridHelper(30, 30, 0x2a3a5c, 0x1a2a4c);
        this.scene.add(this.gridHelper);

        // Ground plane (for shadows)
        const groundGeo = new THREE.PlaneGeometry(30, 30);
        const groundMat = new THREE.ShadowMaterial({ opacity: 0.3 });
        this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
        this.groundPlane.rotation.x = -Math.PI / 2;
        this.groundPlane.receiveShadow = true;
        this.scene.add(this.groundPlane);
    }

    toggleGrid() {
        this.gridVisible = !this.gridVisible;
        this.gridHelper.visible = this.gridVisible;
        return this.gridVisible;
    }

    toggleDimensions() {
        this.dimensionsVisible = !this.dimensionsVisible;
        if (!this.dimensionsVisible) {
            this._removeDimensionLabels();
        }
        return this.dimensionsVisible;
    }

    toggleNotes() {
        this.notesVisible = !this.notesVisible;
        this.notes.forEach(note => {
            note.line.visible = this.notesVisible;
            note.dot.visible = this.notesVisible;
            note.label.visible = this.notesVisible;
        });
        return this.notesVisible;
    }

    toggleSnap() {
        this.snapEnabled = !this.snapEnabled;
        if (this.snapEnabled) {
            this.transformControls.setTranslationSnap(null); // handled by _snapToObjects
            this.transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
        } else {
            this.transformControls.setTranslationSnap(null);
            this.transformControls.setRotationSnap(null);
        }
        return this.snapEnabled;
    }

    setTransformMode(mode) {
        this.transformControls.setMode(mode);
    }

    _onPointerDown(event) {
        if (event.button !== 0) return;
        this._pointerDownPos = { x: event.clientX, y: event.clientY };
        this._pointerIsDown = true;
    }

    _onPointerUp(event) {
        if (event.button !== 0) return;
        if (!this._pointerIsDown) return;
        this._pointerIsDown = false;

        // If the pointer moved more than a few pixels, it was a drag (orbit) — don't change selection
        const dx = event.clientX - this._pointerDownPos.x;
        const dy = event.clientY - this._pointerDownPos.y;
        if (dx * dx + dy * dy > 9) return;

        if (this.transformControls.dragging) return;

        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const meshes = this.objects.map(o => o.group ? o.group : o).filter(Boolean);
        const allMeshes = [];
        meshes.forEach(m => m.traverse(child => {
            if (child.isMesh) allMeshes.push(child);
        }));

        const intersects = this.raycaster.intersectObjects(allMeshes, false);

        if (intersects.length > 0) {
            let target = intersects[0].object;
            // Walk up to find our managed object
            while (target.parent && !this.objects.includes(target)) {
                target = target.parent;
            }
            if (this.objects.includes(target)) {
                this.select(target, event.ctrlKey || event.metaKey);
            }
        } else {
            this.deselect();
        }
    }

    select(obj, additive = false) {
        if (additive) {
            const idx = this.selectedObjects.indexOf(obj);
            if (idx >= 0) {
                // Deselect this object
                this.selectedObjects.splice(idx, 1);
                this._clearHighlight(obj);
                if (this.selectedObjects.length > 0) {
                    this.selectedObject = this.selectedObjects[this.selectedObjects.length - 1];
                } else {
                    this.selectedObject = null;
                    this.transformControls.detach();
                }
            } else {
                this.selectedObjects.push(obj);
                this.selectedObject = obj;
                this._applyHighlight(obj);
            }
        } else {
            this._clearHighlights();
            this.selectedObjects = [obj];
            this.selectedObject = obj;
            this._applyHighlight(obj);
        }

        this._setupSelectionControls();
        if (this.onSelectionChange) this.onSelectionChange(this.selectedObject);
    }

    deselect() {
        this._clearHighlights();
        this.selectedObjects = [];
        this.selectedObject = null;
        this.transformControls.detach();
        if (this.onSelectionChange) this.onSelectionChange(null);
    }

    addObject(obj, autoSelect = true) {
        obj.castShadow = true;
        obj.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        this.scene.add(obj);
        this.objects.push(obj);
        if (autoSelect) this.select(obj);
        if (this.onObjectsChange) this.onObjectsChange(this.objects);
    }

    removeObject(obj) {
        if (!obj) return;
        this.scene.remove(obj);
        const idx = this.objects.indexOf(obj);
        if (idx >= 0) this.objects.splice(idx, 1);
        const selIdx = this.selectedObjects.indexOf(obj);
        if (selIdx >= 0) this.selectedObjects.splice(selIdx, 1);
        // Dispose geometry/material
        obj.traverse(child => {
            if (child.isMesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });
        if (this.selectedObjects.length === 0) {
            this.selectedObject = null;
            this.transformControls.detach();
            if (this.onSelectionChange) this.onSelectionChange(null);
        } else {
            this.selectedObject = this.selectedObjects[this.selectedObjects.length - 1];
            this._setupSelectionControls();
        }
        if (this.onObjectsChange) this.onObjectsChange(this.objects);
    }

    duplicateSelected() {
        if (this.selectedObjects.length === 0) return;
        const sources = [...this.selectedObjects];
        const newObjs = sources.map(orig => {
            const obj = orig.clone();
            obj.traverse(child => {
                if (child.isMesh) {
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(m => m.clone());
                    } else if (child.material) {
                        child.material = child.material.clone();
                    }
                }
            });
            obj.position.x += 0.5;
            obj.position.z += 0.5;
            if (orig.userData) {
                obj.userData = JSON.parse(JSON.stringify(orig.userData));
                obj.userData.name = (obj.userData.name || 'Object') + ' ' + t('copy_suffix');
            }
            return obj;
        });
        this.deselect();
        newObjs.forEach(obj => this.addObject(obj, false));
        newObjs.forEach((obj, i) => this.select(obj, i > 0));
    }

    // ===== Multi-selection helpers =====

    _setupSelectionControls() {
        if (this.selectedObjects.length === 1) {
            this.transformControls.attach(this.selectedObjects[0]);
        } else if (this.selectedObjects.length > 1) {
            this._resetPivot();
            this.transformControls.attach(this._selectionPivot);
        } else {
            this.transformControls.detach();
        }
    }

    _resetPivot() {
        const center = new THREE.Vector3();
        this.selectedObjects.forEach(obj => center.add(obj.position));
        center.divideScalar(this.selectedObjects.length);
        this._selectionPivot.position.copy(center);
        this._selectionPivot.rotation.set(0, 0, 0);
        this._selectionPivot.scale.set(1, 1, 1);
        this._pivotPrevPosition.copy(center);
        this._pivotPrevQuaternion.identity();
        this._pivotPrevScale.set(1, 1, 1);
    }

    _applyGroupTransform() {
        const pivot = this._selectionPivot;
        const mode = this.transformControls.mode;

        if (mode === 'translate') {
            const delta = new THREE.Vector3().subVectors(pivot.position, this._pivotPrevPosition);
            if (this.snapEnabled) {
                pivot.position.x = Math.round(pivot.position.x / this.snapValue) * this.snapValue;
                pivot.position.y = Math.round(pivot.position.y / this.snapValue) * this.snapValue;
                pivot.position.z = Math.round(pivot.position.z / this.snapValue) * this.snapValue;
                delta.subVectors(pivot.position, this._pivotPrevPosition);
            }
            this.selectedObjects.forEach(obj => obj.position.add(delta));
            this._pivotPrevPosition.copy(pivot.position);
        } else if (mode === 'rotate') {
            const prevQInv = this._pivotPrevQuaternion.clone().invert();
            const deltaQ = pivot.quaternion.clone().multiply(prevQInv);
            const pivotPos = this._pivotPrevPosition.clone();
            this.selectedObjects.forEach(obj => {
                const offset = obj.position.clone().sub(pivotPos);
                offset.applyQuaternion(deltaQ);
                obj.position.copy(pivotPos).add(offset);
                obj.quaternion.premultiply(deltaQ);
            });
            this._pivotPrevQuaternion.copy(pivot.quaternion);
        } else if (mode === 'scale') {
            const ps = this._pivotPrevScale;
            const deltaScale = new THREE.Vector3(
                ps.x !== 0 ? pivot.scale.x / ps.x : 1,
                ps.y !== 0 ? pivot.scale.y / ps.y : 1,
                ps.z !== 0 ? pivot.scale.z / ps.z : 1
            );
            const pivotPos = this._pivotPrevPosition.clone();
            this.selectedObjects.forEach(obj => {
                const offset = obj.position.clone().sub(pivotPos);
                offset.multiply(deltaScale);
                obj.position.copy(pivotPos).add(offset);
                obj.scale.multiply(deltaScale);
            });
            this._pivotPrevScale.copy(pivot.scale);
        }
    }

    _snapToObjects(obj) {
        const snapThreshold = 0.15; // 15cm proximity to trigger object snap
        const box = new THREE.Box3().setFromObject(obj);

        // Collect snap edges from all other objects
        const xEdges = [], yEdges = [], zEdges = [];
        for (const other of this.objects) {
            if (other === obj) continue;
            const ob = new THREE.Box3().setFromObject(other);
            xEdges.push(ob.min.x, ob.max.x);
            yEdges.push(ob.min.y, ob.max.y);
            zEdges.push(ob.min.z, ob.max.z);
        }

        // For each axis, check if any edge of dragged obj is near a target edge
        const trySnap = (edges, myMin, myMax) => {
            let bestDist = snapThreshold;
            let bestShift = 0;
            for (const edge of edges) {
                // My min face → target edge
                const d1 = Math.abs(myMin - edge);
                if (d1 < bestDist) { bestDist = d1; bestShift = edge - myMin; }
                // My max face → target edge
                const d2 = Math.abs(myMax - edge);
                if (d2 < bestDist) { bestDist = d2; bestShift = edge - myMax; }
            }
            return bestShift;
        };

        const shiftX = trySnap(xEdges, box.min.x, box.max.x);
        const shiftY = trySnap(yEdges, box.min.y, box.max.y);
        const shiftZ = trySnap(zEdges, box.min.z, box.max.z);

        if (shiftX !== 0 || shiftY !== 0 || shiftZ !== 0) {
            obj.position.x += shiftX;
            obj.position.y += shiftY;
            obj.position.z += shiftZ;
        } else {
            // Fall back to grid snap
            obj.position.x = Math.round(obj.position.x / this.snapValue) * this.snapValue;
            obj.position.y = Math.round(obj.position.y / this.snapValue) * this.snapValue;
            obj.position.z = Math.round(obj.position.z / this.snapValue) * this.snapValue;
        }
    }

    _applyHighlight(obj) {
        obj.traverse(child => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => m.emissive && m.emissive.setHex(0x111122));
            }
        });
    }

    _clearHighlight(obj) {
        obj.traverse(child => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => m.emissive && m.emissive.setHex(0x000000));
            }
        });
    }

    _clearHighlights() {
        this.objects.forEach(o => this._clearHighlight(o));
    }

    // ===== Dimension labels =====

    _makeDimLabel(text) {
        const div = document.createElement('div');
        div.className = 'dim-label';
        div.textContent = text;
        const label = new CSS2DObject(div);
        label.layers.set(0);
        return label;
    }

    _makeDimLine(start, end, color) {
        const mat = new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.7 });
        const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const line = new THREE.Line(geo, mat);
        line.renderOrder = 999;
        return line;
    }

    _removeDimensionLabels() {
        this._dimensionLabels.forEach(obj => {
            if (obj.parent) obj.parent.remove(obj);
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
            if (obj.element) obj.element.remove();
        });
        this._dimensionLabels = [];
    }

    _updateDimensionLabels() {
        this._removeDimensionLabels();
        if (!this.dimensionsVisible) return;

        // If something is selected, only show dimensions for selected objects
        const targets = this.selectedObjects.length > 0 ? this.selectedObjects : this.objects;

        targets.forEach(obj => {
            if (!obj.visible) return;
            const box = new THREE.Box3().setFromObject(obj);
            const min = box.min;
            const max = box.max;
            const pad = 0.12; // offset from object

            // For rooms/walls/floors, use the param values for labels
            const params = obj.userData?.params;
            const type = obj.userData?.type;
            const useParams = params && ['room', 'wall', 'floor'].includes(type);
            const w = useParams && params.width != null ? params.width : (max.x - min.x);
            const h = useParams && params.height != null ? params.height : (max.y - min.y);
            const d = useParams && params.depth != null ? params.depth : (max.z - min.z);

            // Width line (bottom front edge)
            const wStart = new THREE.Vector3(min.x, min.y, max.z + pad);
            const wEnd = new THREE.Vector3(max.x, min.y, max.z + pad);
            const wLine = this._makeDimLine(wStart, wEnd, 0xff4444);
            this.scene.add(wLine);
            this._dimensionLabels.push(wLine);

            const wLabel = this._makeDimLabel((w * 100).toFixed(0) + ' cm');
            wLabel.position.copy(wStart).lerp(wEnd, 0.5);
            wLabel.position.z += 0.06;
            this.scene.add(wLabel);
            this._dimensionLabels.push(wLabel);

            // Tick marks for width
            for (const p of [wStart, wEnd]) {
                const tick = this._makeDimLine(
                    new THREE.Vector3(p.x, p.y, p.z - 0.04),
                    new THREE.Vector3(p.x, p.y, p.z + 0.04),
                    0xff4444
                );
                this.scene.add(tick);
                this._dimensionLabels.push(tick);
            }

            // Height line (right front edge)
            const hStart = new THREE.Vector3(max.x + pad, min.y, max.z);
            const hEnd = new THREE.Vector3(max.x + pad, max.y, max.z);
            const hLine = this._makeDimLine(hStart, hEnd, 0x44ff44);
            this.scene.add(hLine);
            this._dimensionLabels.push(hLine);

            const hLabel = this._makeDimLabel((h * 100).toFixed(0) + ' cm');
            hLabel.position.copy(hStart).lerp(hEnd, 0.5);
            hLabel.position.x += 0.06;
            this.scene.add(hLabel);
            this._dimensionLabels.push(hLabel);

            for (const p of [hStart, hEnd]) {
                const tick = this._makeDimLine(
                    new THREE.Vector3(p.x - 0.04, p.y, p.z),
                    new THREE.Vector3(p.x + 0.04, p.y, p.z),
                    0x44ff44
                );
                this.scene.add(tick);
                this._dimensionLabels.push(tick);
            }

            // Depth line (bottom right edge)
            const dStart = new THREE.Vector3(max.x + pad, min.y, min.z);
            const dEnd = new THREE.Vector3(max.x + pad, min.y, max.z);
            const dLine = this._makeDimLine(dStart, dEnd, 0x4488ff);
            this.scene.add(dLine);
            this._dimensionLabels.push(dLine);

            const dLabel = this._makeDimLabel((d * 100).toFixed(0) + ' cm');
            dLabel.position.copy(dStart).lerp(dEnd, 0.5);
            dLabel.position.x += 0.06;
            this.scene.add(dLabel);
            this._dimensionLabels.push(dLabel);

            for (const p of [dStart, dEnd]) {
                const tick = this._makeDimLine(
                    new THREE.Vector3(p.x - 0.04, p.y, p.z),
                    new THREE.Vector3(p.x + 0.04, p.y, p.z),
                    0x4488ff
                );
                this.scene.add(tick);
                this._dimensionLabels.push(tick);
            }

            // Shelf spacing dimensions
            const shelfTypes = ['cabinet', 'shelf', 'bookcase', 'wardrobe'];
            if (params?.shelfPositions?.length > 0 && shelfTypes.includes(type)) {
                const t = 0.02;
                const objH = params.height;
                const baseY = obj.position.y;
                const xPos = min.x - pad;
                const zPos = max.z;
                const shelfColor = 0xffaa44;

                // Build sorted list: bottom, shelves, top
                const allY = [0];
                params.shelfPositions.forEach(sp => allY.push(t + sp));
                allY.push(objH);
                allY.sort((a, b) => a - b);

                for (let i = 0; i < allY.length - 1; i++) {
                    const y0 = baseY + allY[i];
                    const y1 = baseY + allY[i + 1];
                    const gap = (allY[i + 1] - allY[i]) * 100;
                    if (gap < 1) continue;

                    const s = new THREE.Vector3(xPos, y0, zPos);
                    const e = new THREE.Vector3(xPos, y1, zPos);
                    const line = this._makeDimLine(s, e, shelfColor);
                    this.scene.add(line);
                    this._dimensionLabels.push(line);

                    const lbl = this._makeDimLabel(gap.toFixed(0) + ' cm');
                    lbl.position.copy(s).lerp(e, 0.5);
                    lbl.position.x -= 0.06;
                    lbl.element.classList.add('dim-label-shelf');
                    this.scene.add(lbl);
                    this._dimensionLabels.push(lbl);

                    // Tick marks
                    for (const p of [s, e]) {
                        const tk = this._makeDimLine(
                            new THREE.Vector3(p.x - 0.04, p.y, p.z),
                            new THREE.Vector3(p.x + 0.04, p.y, p.z),
                            shelfColor
                        );
                        this.scene.add(tk);
                        this._dimensionLabels.push(tk);
                    }
                }
            }
        });
    }

    resetCamera() {
        this.camera.position.set(5, 4, 7);
        this.orbitControls.target.set(0, 0.5, 0);
        this.orbitControls.update();
    }

    focusSelected() {
        if (!this.selectedObject) return;
        const box = new THREE.Box3().setFromObject(this.selectedObject);
        const center = box.getCenter(new THREE.Vector3());
        this.orbitControls.target.copy(center);
        this.orbitControls.update();
    }

    getSceneInfo() {
        let vertices = 0;
        this.objects.forEach(obj => {
            obj.traverse(child => {
                if (child.isMesh && child.geometry) {
                    vertices += child.geometry.attributes.position?.count || 0;
                }
            });
        });
        return { objects: this.objects.length, vertices };
    }

    clearScene() {
        while (this.objects.length > 0) {
            this.removeObject(this.objects[0]);
        }
    }

    takeScreenshot() {
        this.renderer.render(this.scene, this.camera);
        return this.canvas.toDataURL('image/png');
    }

    _onResize() {
        const container = this.canvas.parentElement;
        const w = container.clientWidth;
        const h = container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h, false);
        this.labelRenderer.setSize(w, h);
    }

    // ========== FLOATING NOTES ==========
    addNote(text, anchorPos, labelOffset) {
        const id = ++this._noteIdCounter;
        const anchor = anchorPos.clone();
        const labelPos = anchor.clone().add(labelOffset || new THREE.Vector3(0, 0.5, 0));

        // Pointer line from anchor to label
        const lineMat = new THREE.LineBasicMaterial({
            color: 0xffcc00, depthTest: false, transparent: true, opacity: 0.8
        });
        const lineGeo = new THREE.BufferGeometry().setFromPoints([anchor.clone(), labelPos.clone()]);
        const line = new THREE.Line(lineGeo, lineMat);
        line.renderOrder = 998;
        this.scene.add(line);

        // Small sphere at anchor point
        const dotGeo = new THREE.SphereGeometry(0.03, 8, 8);
        const dotMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, depthTest: false });
        const dot = new THREE.Mesh(dotGeo, dotMat);
        dot.position.copy(anchor);
        dot.renderOrder = 998;
        this.scene.add(dot);

        // CSS2D label
        const div = document.createElement('div');
        div.className = 'scene-note';
        div.innerHTML = `<span class="note-drag-handle material-icons-round">drag_indicator</span><span class="note-text">${this._escapeNoteText(text)}</span>`;
        div.style.pointerEvents = 'auto';

        const label = new CSS2DObject(div);
        label.position.copy(labelPos);
        label.layers.set(0);
        this.scene.add(label);

        const note = { id, text, anchor, labelPos, line, lineGeo, lineMat, dot, label, div };
        this.notes.push(note);

        // Drag to move label, Alt+drag to move anchor
        this._bindNoteDrag(note);

        // Edit on double-click
        div.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this._editNoteInline(note);
        });

        return note;
    }

    _escapeNoteText(str) {
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    _bindNoteDrag(note) {
        const div = note.div;
        let dragStartNDC = null;
        let dragMode = null;
        let startX, startY;
        let dragging = false;

        div.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            e.stopPropagation();

            startX = e.clientX;
            startY = e.clientY;
            dragging = false;
            dragMode = e.altKey ? 'anchor' : 'label';
            const pos = dragMode === 'label' ? note.labelPos : note.anchor;
            dragStartNDC = pos.clone().project(this.camera);

            const onMove = (me) => {
                const dx = me.clientX - startX;
                const dy = me.clientY - startY;
                if (!dragging && Math.abs(dx) + Math.abs(dy) < 4) return;
                dragging = true;

                const container = this.canvas.parentElement;
                const ndc = dragStartNDC.clone();
                ndc.x += (dx / container.clientWidth) * 2;
                ndc.y -= (dy / container.clientHeight) * 2;

                const newPos = new THREE.Vector3(ndc.x, ndc.y, ndc.z).unproject(this.camera);

                if (dragMode === 'label') {
                    note.labelPos.copy(newPos);
                    note.label.position.copy(newPos);
                } else {
                    note.anchor.copy(newPos);
                    note.dot.position.copy(newPos);
                }
                this.updateNoteLine(note);
            };

            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            };

            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    _editNoteInline(note) {
        const div = note.div;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'scene-note-input';
        input.value = note.text;
        input.style.pointerEvents = 'auto';

        div.textContent = '';
        div.appendChild(input);
        input.focus();
        input.select();

        const finish = () => {
            const val = input.value.trim();
            note.text = val || note.text;
            div.innerHTML = `<span class="note-drag-handle material-icons-round">drag_indicator</span><span class="note-text">${this._escapeNoteText(note.text)}</span>`;
            // Re-bind drag since innerHTML was replaced
            this._bindNoteDrag(note);
            div.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                this._editNoteInline(note);
            });
        };
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { input.blur(); }
            if (e.key === 'Escape') { input.value = note.text; input.blur(); }
            e.stopPropagation();
        });
    }

    removeNote(note) {
        const idx = this.notes.indexOf(note);
        if (idx < 0) return;
        this.notes.splice(idx, 1);
        this.scene.remove(note.line);
        this.scene.remove(note.dot);
        this.scene.remove(note.label);
        note.lineGeo.dispose();
        note.lineMat.dispose();
        note.dot.geometry.dispose();
        note.dot.material.dispose();
        if (note.div.parentNode) note.div.remove();
    }

    removeNoteById(id) {
        const note = this.notes.find(n => n.id === id);
        if (note) this.removeNote(note);
    }

    clearNotes() {
        while (this.notes.length > 0) {
            this.removeNote(this.notes[0]);
        }
    }

    updateNoteLine(note) {
        const positions = note.line.geometry.attributes.position.array;
        positions[0] = note.anchor.x;
        positions[1] = note.anchor.y;
        positions[2] = note.anchor.z;
        positions[3] = note.labelPos.x;
        positions[4] = note.labelPos.y;
        positions[5] = note.labelPos.z;
        note.line.geometry.attributes.position.needsUpdate = true;
    }

    _animate() {
        requestAnimationFrame(() => this._animate());
        this.orbitControls.update();
        if (this.dimensionsVisible) this._updateDimensionLabels();
        this.renderer.render(this.scene, this.camera);
        this.labelRenderer.render(this.scene, this.camera);
    }
}
