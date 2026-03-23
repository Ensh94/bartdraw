import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

export class SceneManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.objects = [];
        this.selectedObject = null;
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
        });
        this.transformControls.addEventListener('objectChange', () => {
            if (this.snapEnabled) {
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
                this.select(target);
            }
        } else {
            this.deselect();
        }
    }

    select(obj) {
        this.selectedObject = obj;
        this.transformControls.attach(obj);
        // Highlight
        this.objects.forEach(o => {
            o.traverse(child => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.emissive && m.emissive.setHex(0x000000));
                    } else if (child.material.emissive) {
                        child.material.emissive.setHex(0x000000);
                    }
                }
            });
        });
        obj.traverse(child => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.emissive && m.emissive.setHex(0x111122));
                } else if (child.material.emissive) {
                    child.material.emissive.setHex(0x111122);
                }
            }
        });
        if (this.onSelectionChange) this.onSelectionChange(obj);
    }

    deselect() {
        if (this.selectedObject) {
            this.selectedObject.traverse(child => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.emissive && m.emissive.setHex(0x000000));
                    } else if (child.material.emissive) {
                        child.material.emissive.setHex(0x000000);
                    }
                }
            });
        }
        this.selectedObject = null;
        this.transformControls.detach();
        if (this.onSelectionChange) this.onSelectionChange(null);
    }

    addObject(obj) {
        obj.castShadow = true;
        obj.traverse(child => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        this.scene.add(obj);
        this.objects.push(obj);
        this.select(obj);
        if (this.onObjectsChange) this.onObjectsChange(this.objects);
    }

    removeObject(obj) {
        if (!obj) return;
        this.transformControls.detach();
        this.scene.remove(obj);
        const idx = this.objects.indexOf(obj);
        if (idx >= 0) this.objects.splice(idx, 1);
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
        this.selectedObject = null;
        if (this.onSelectionChange) this.onSelectionChange(null);
        if (this.onObjectsChange) this.onObjectsChange(this.objects);
    }

    duplicateSelected() {
        if (!this.selectedObject) return;
        const obj = this.selectedObject.clone();
        // Deep clone materials
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
        if (this.selectedObject.userData) {
            obj.userData = JSON.parse(JSON.stringify(this.selectedObject.userData));
            obj.userData.name = (obj.userData.name || 'Object') + ' (copy)';
        }
        this.addObject(obj);
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
