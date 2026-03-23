import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
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
        this.snapValue = 0.25;

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
                    obj.position.x = Math.round(obj.position.x / this.snapValue) * this.snapValue;
                    obj.position.y = Math.round(obj.position.y / this.snapValue) * this.snapValue;
                    obj.position.z = Math.round(obj.position.z / this.snapValue) * this.snapValue;
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

        // Events
        this.canvas.addEventListener('pointerdown', (e) => this._onPointerDown(e));
        window.addEventListener('resize', () => this._onResize());

        this._onResize();
        this._animate();
    }

    _setupLights() {
        // Ambient
        const ambient = new THREE.AmbientLight(0x8090b0, 0.6);
        this.scene.add(ambient);

        // Hemisphere
        const hemi = new THREE.HemisphereLight(0xc8d8f0, 0x2a1a0a, 0.4);
        this.scene.add(hemi);

        // Key light
        const dirLight = new THREE.DirectionalLight(0xffeedd, 1.2);
        dirLight.position.set(8, 12, 6);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.set(2048, 2048);
        dirLight.shadow.camera.left = -15;
        dirLight.shadow.camera.right = 15;
        dirLight.shadow.camera.top = 15;
        dirLight.shadow.camera.bottom = -15;
        dirLight.shadow.camera.near = 0.1;
        dirLight.shadow.camera.far = 40;
        dirLight.shadow.bias = -0.001;
        this.scene.add(dirLight);

        // Fill light
        const fillLight = new THREE.DirectionalLight(0x8899cc, 0.3);
        fillLight.position.set(-5, 6, -3);
        this.scene.add(fillLight);

        // Rim light
        const rimLight = new THREE.DirectionalLight(0x4fc3f7, 0.2);
        rimLight.position.set(-3, 4, 8);
        this.scene.add(rimLight);
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

    toggleSnap() {
        this.snapEnabled = !this.snapEnabled;
        if (this.snapEnabled) {
            this.transformControls.setTranslationSnap(this.snapValue);
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
    }

    _animate() {
        requestAnimationFrame(() => this._animate());
        this.orbitControls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
