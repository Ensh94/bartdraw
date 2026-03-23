import * as THREE from 'three';
import { getParamDefs, createModel } from './models.js';
import { t, onLangChange } from './i18n.js';

export class UIController {
    constructor(sceneManager) {
        this.scene = sceneManager;
        this.undoStack = [];
        this.redoStack = [];
        this._maxUndoSteps = 50;

        this._initToast();
        this._bindToolbar();
        this._bindLibrary();
        this._bindKeyboard();
        this._bindContextMenu();
        this._updateLoop();

        this.scene.onSelectionChange = (obj) => this._updateProperties(obj);
        this.scene.onObjectsChange = () => this._updateHierarchy();

        onLangChange(() => this._applyLanguage());
    }

    _applyLanguage() {
        // Update all data-i18n elements
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.textContent = t(el.dataset.i18n);
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            el.title = t(el.dataset.i18nTitle);
        });
        // Update status bar
        document.getElementById('status-grid').textContent = t(this.scene.gridVisible ? 'grid_on' : 'grid_off');
        document.getElementById('status-snap').textContent = t(this.scene.snapEnabled ? 'snap_on' : 'snap_off');
        const mode = this.scene.transformControls.mode;
        const modeKeys = { 'translate': 'translate', 'rotate': 'label_rotation', 'scale': 'label_scale' };
        document.getElementById('status-transform').textContent = t(modeKeys[mode] || 'translate');
        // Re-render dynamic panels
        this._updateHierarchy();
        if (this.scene.selectedObject) {
            this._updateProperties(this.scene.selectedObject);
        }
    }

    // ========== TOAST ========== 
    _initToast() {
        this.toastContainer = document.createElement('div');
        this.toastContainer.id = 'toast-container';
        document.body.appendChild(this.toastContainer);
    }

    toast(message, type = 'info') {
        const icons = { info: 'info', success: 'check_circle', error: 'error' };
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.innerHTML = `<span class="material-icons-round">${icons[type] || 'info'}</span><span>${this._escapeHtml(message)}</span>`;
        this.toastContainer.appendChild(el);
        setTimeout(() => {
            el.style.animation = 'slideOut 0.2s ease forwards';
            setTimeout(() => el.remove(), 200);
        }, 3000);
    }

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    setStatus(msg) {
        document.getElementById('status-message').textContent = msg;
    }

    // ========== TOOLBAR ========== 
    _bindToolbar() {
        const $ = (id) => document.getElementById(id);

        // Transform modes
        const transformBtns = { 'btn-translate': 'translate', 'btn-rotate': 'rotate', 'btn-scale': 'scale' };
        Object.entries(transformBtns).forEach(([id, mode]) => {
            $(id).addEventListener('click', () => {
                this.scene.setTransformMode(mode);
                Object.keys(transformBtns).forEach(bid => $(bid).classList.remove('active'));
                $(id).classList.add('active');
                const modeKeys = { 'translate': 'translate', 'rotate': 'label_rotation', 'scale': 'label_scale' };
                $('status-transform').textContent = t(modeKeys[mode]);
            });
        });

        // Duplicate & Delete
        $('btn-duplicate').addEventListener('click', () => this.duplicateSelected());
        $('btn-delete').addEventListener('click', () => this.deleteSelected());

        // Undo & Redo
        $('btn-undo').addEventListener('click', () => this.undo());
        $('btn-redo').addEventListener('click', () => this.redo());

        // Grid & Snap
        $('btn-grid-toggle').addEventListener('click', () => {
            const v = this.scene.toggleGrid();
            $('status-grid').textContent = t(v ? 'grid_on' : 'grid_off');
            $('btn-grid-toggle').classList.toggle('active', v);
        });
        $('btn-snap-toggle').addEventListener('click', () => {
            const v = this.scene.toggleSnap();
            $('status-snap').textContent = t(v ? 'snap_on' : 'snap_off');
            $('btn-snap-toggle').classList.toggle('active', v);
        });

        // Camera reset
        $('btn-camera-reset').addEventListener('click', () => this.scene.resetCamera());
    }

    // ========== OBJECT LIBRARY ========== 
    _bindLibrary() {
        document.querySelectorAll('.library-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                this.addObject(type);
            });
        });
    }

    addObject(type, params = {}) {
        const obj = createModel(type, params);
        if (!obj) return;
        this._saveUndoState();
        this.scene.addObject(obj);
        this._updateHierarchy();
        this.toast(`${t('added')} ${t(type) || obj.userData.name}`, 'success');
        this.setStatus(`${t('added')} ${t(type) || obj.userData.name}`);
    }

    duplicateSelected() {
        if (this.scene.selectedObjects.length === 0) {
            this.toast(t('no_selection'), 'error');
            return;
        }
        this._saveUndoState();
        this.scene.duplicateSelected();
        this._updateHierarchy();
        this.toast(t('duplicated'), 'success');
    }

    deleteSelected() {
        if (this.scene.selectedObjects.length === 0) {
            this.toast(t('no_selection'), 'error');
            return;
        }
        this._saveUndoState();
        const objs = [...this.scene.selectedObjects];
        const count = objs.length;
        objs.forEach(obj => this.scene.removeObject(obj));
        this._updateHierarchy();
        const msg = count > 1
            ? `${t('deleted')} ${count} ${t('objects').toLowerCase()}`
            : `${t('deleted')} ${objs[0]?.userData?.name || 'Object'}`;
        this.toast(msg, 'info');
        this.setStatus(msg);
    }

    // ========== UNDO / REDO ==========
    _saveUndoState() {
        const state = this._serializeScene();
        this.undoStack.push(state);
        if (this.undoStack.length > this._maxUndoSteps) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }

    undo() {
        if (this.undoStack.length === 0) {
            this.toast(t('nothing_undo'), 'info');
            return;
        }
        const currentState = this._serializeScene();
        this.redoStack.push(currentState);
        const prevState = this.undoStack.pop();
        this._restoreScene(prevState);
        this.toast(t('undo_msg'), 'info');
    }

    redo() {
        if (this.redoStack.length === 0) {
            this.toast(t('nothing_redo'), 'info');
            return;
        }
        const currentState = this._serializeScene();
        this.undoStack.push(currentState);
        const nextState = this.redoStack.pop();
        this._restoreScene(nextState);
        this.toast(t('redo_msg'), 'info');
    }

    _serializeScene() {
        return this.scene.objects.map(obj => ({
            type: obj.userData.type,
            name: obj.userData.name,
            params: { ...obj.userData.params },
            position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
            rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
            scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
        }));
    }

    _restoreScene(stateArr) {
        this.scene.clearScene();
        stateArr.forEach(s => {
            const obj = createModel(s.type, s.params);
            if (!obj) return;
            obj.userData.name = s.name;
            obj.position.set(s.position.x, s.position.y, s.position.z);
            obj.rotation.set(s.rotation.x, s.rotation.y, s.rotation.z);
            obj.scale.set(s.scale.x, s.scale.y, s.scale.z);
            this.scene.addObject(obj);
        });
        this.scene.deselect();
        this._updateHierarchy();
    }

    // ========== HIERARCHY ========== 
    _updateHierarchy() {
        const panel = document.getElementById('scene-hierarchy');
        if (this.scene.objects.length === 0) {
            panel.innerHTML = `<div class="hierarchy-empty">${t('no_objects')}</div>`;
            return;
        }
        panel.innerHTML = '';
        this.scene.objects.forEach((obj, i) => {
            const item = document.createElement('div');
            const isSelected = this.scene.selectedObjects.includes(obj);
            item.className = 'hierarchy-item' + (isSelected ? ' selected' : '');
            const icon = obj.userData?.icon || 'category';
            const name = obj.userData?.name || `Object ${i + 1}`;
            item.innerHTML = `
                <span class="material-icons-round">${this._escapeHtml(icon)}</span>
                <span class="item-name">${this._escapeHtml(name)}</span>
                <span class="material-icons-round item-visibility" title="Toggle visibility">
                    ${obj.visible ? 'visibility' : 'visibility_off'}
                </span>`;
            item.querySelector('.item-name').addEventListener('click', (e) => {
                this.scene.select(obj, e.ctrlKey || e.metaKey);
                this._updateHierarchy();
            });
            item.querySelector('.item-visibility').addEventListener('click', (e) => {
                e.stopPropagation();
                obj.visible = !obj.visible;
                this._updateHierarchy();
            });
            panel.appendChild(item);
        });
    }

    // ========== PROPERTIES PANEL ========== 
    _updateProperties(obj) {
        this._updateHierarchy();
        const panel = document.getElementById('properties-panel');
        const matPanel = document.getElementById('material-panel');

        if (!obj) {
            panel.innerHTML = `<div class="props-empty">${t('select_to_edit')}</div>`;
            matPanel.innerHTML = `<div class="props-empty">${t('select_for_material')}</div>`;
            return;
        }

        // Multi-selection: show summary
        if (this.scene.selectedObjects.length > 1) {
            const count = this.scene.selectedObjects.length;
            panel.innerHTML = `<div class="props-empty" style="text-align:center;padding:16px;">
                <span class="material-icons-round" style="font-size:32px;color:var(--accent);display:block;margin-bottom:8px;">select_all</span>
                <b>${count} ${t('objects_selected')}</b>
                <div style="margin-top:8px;font-size:11px;color:var(--text-muted)">${t('multi_select_hint')}</div>
            </div>`;
            matPanel.innerHTML = '';
            return;
        }

        const ud = obj.userData || {};
        let html = '';

        // Name
        html += `<input class="prop-name-input" id="prop-name" value="${this._escapeHtml(ud.name || 'Object')}" />`;

        // Transform
        html += this._transformSection(obj);

        // Model parameters
        if (ud.type) {
            const defs = getParamDefs(ud.type);
            if (defs.length > 0) {
                html += `<div class="prop-group"><div class="prop-group-title">${t('parameters')}</div>`;
                defs.forEach(def => {
                    const val = ud.params?.[def.key];
                    const label = t(def.i18nKey || def.key) || def.label;
                    if (def.type === 'color') {
                        const hex = '#' + new THREE.Color(val).getHexString();
                        html += `<div class="prop-row">
                            <span class="prop-label">${label}</span>
                            <input type="color" class="prop-input" data-param="${def.key}" value="${hex}">
                        </div>`;
                    } else {
                        html += `<div class="prop-row">
                            <span class="prop-label">${label}</span>
                            <input type="number" class="prop-input" data-param="${def.key}" 
                                value="${val}" min="${def.min}" max="${def.max}" step="${def.step}">
                        </div>`;
                    }
                });
                html += '</div>';
            }
        }

        panel.innerHTML = html;

        // Bind name change
        const nameInput = document.getElementById('prop-name');
        nameInput?.addEventListener('change', () => {
            obj.userData.name = nameInput.value;
            this._updateHierarchy();
        });

        // Bind transform inputs
        this._bindTransformInputs(obj);

        // Bind parameter inputs
        panel.querySelectorAll('[data-param]').forEach(input => {
            input.addEventListener('change', () => {
                this._saveUndoState();
                const key = input.dataset.param;
                let value;
                if (input.type === 'color') {
                    value = new THREE.Color(input.value).getHex();
                } else if (input.step === '1') {
                    value = parseInt(input.value, 10);
                } else {
                    value = parseFloat(input.value);
                }
                const params = { ...obj.userData.params, [key]: value };
                const pos = obj.position.clone();
                const rot = obj.rotation.clone();
                const scale = obj.scale.clone();
                const name = obj.userData.name;
                const type = obj.userData.type;

                this.scene.removeObject(obj);
                const newObj = createModel(type, params);
                if (newObj) {
                    newObj.position.copy(pos);
                    newObj.rotation.copy(rot);
                    newObj.scale.copy(scale);
                    newObj.userData.name = name;
                    this.scene.addObject(newObj);
                    this._updateHierarchy();
                }
            });
        });

        // Material panel
        this._updateMaterialPanel(obj);
    }

    _transformSection(obj) {
        const p = obj.position;
        const r = obj.rotation;
        const s = obj.scale;
        const deg = THREE.MathUtils.radToDeg;

        return `
        <div class="prop-group">
            <div class="prop-group-title">${t('transform')}</div>
            <div class="prop-row">
                <span class="prop-label">${t('position')}</span>
                <div class="prop-vector">
                    <div class="vector-field">
                        <span class="vector-label x">X</span>
                        <input type="number" class="prop-input" data-transform="px" value="${p.x.toFixed(3)}" step="0.05">
                    </div>
                    <div class="vector-field">
                        <span class="vector-label y">Y</span>
                        <input type="number" class="prop-input" data-transform="py" value="${p.y.toFixed(3)}" step="0.05">
                    </div>
                    <div class="vector-field">
                        <span class="vector-label z">Z</span>
                        <input type="number" class="prop-input" data-transform="pz" value="${p.z.toFixed(3)}" step="0.05">
                    </div>
                </div>
            </div>
            <div class="prop-row">
                <span class="prop-label">${t('rotation')}</span>
                <div class="prop-vector">
                    <div class="vector-field">
                        <span class="vector-label x">X</span>
                        <input type="number" class="prop-input" data-transform="rx" value="${deg(r.x).toFixed(1)}" step="5">
                    </div>
                    <div class="vector-field">
                        <span class="vector-label y">Y</span>
                        <input type="number" class="prop-input" data-transform="ry" value="${deg(r.y).toFixed(1)}" step="5">
                    </div>
                    <div class="vector-field">
                        <span class="vector-label z">Z</span>
                        <input type="number" class="prop-input" data-transform="rz" value="${deg(r.z).toFixed(1)}" step="5">
                    </div>
                </div>
            </div>
            <div class="prop-row">
                <span class="prop-label">${t('label_scale')}</span>
                <div class="prop-vector">
                    <div class="vector-field">
                        <span class="vector-label x">X</span>
                        <input type="number" class="prop-input" data-transform="sx" value="${s.x.toFixed(3)}" step="0.1" min="0.01">
                    </div>
                    <div class="vector-field">
                        <span class="vector-label y">Y</span>
                        <input type="number" class="prop-input" data-transform="sy" value="${s.y.toFixed(3)}" step="0.1" min="0.01">
                    </div>
                    <div class="vector-field">
                        <span class="vector-label z">Z</span>
                        <input type="number" class="prop-input" data-transform="sz" value="${s.z.toFixed(3)}" step="0.1" min="0.01">
                    </div>
                </div>
            </div>
        </div>`;
    }

    _bindTransformInputs(obj) {
        const rad = THREE.MathUtils.degToRad;
        document.querySelectorAll('[data-transform]').forEach(input => {
            input.addEventListener('change', () => {
                const val = parseFloat(input.value);
                if (isNaN(val)) return;
                const key = input.dataset.transform;
                switch (key) {
                    case 'px': obj.position.x = val; break;
                    case 'py': obj.position.y = val; break;
                    case 'pz': obj.position.z = val; break;
                    case 'rx': obj.rotation.x = rad(val); break;
                    case 'ry': obj.rotation.y = rad(val); break;
                    case 'rz': obj.rotation.z = rad(val); break;
                    case 'sx': obj.scale.x = Math.max(0.01, val); break;
                    case 'sy': obj.scale.y = Math.max(0.01, val); break;
                    case 'sz': obj.scale.z = Math.max(0.01, val); break;
                }
            });
        });
    }

    _updateMaterialPanel(obj) {
        const panel = document.getElementById('material-panel');
        
        // Find first mesh material
        let material = null;
        obj.traverse(child => {
            if (child.isMesh && child.material && !material) {
                material = Array.isArray(child.material) ? child.material[0] : child.material;
            }
        });

        if (!material) {
            panel.innerHTML = `<div class="props-empty">${t('no_material')}</div>`;
            return;
        }

        const color = '#' + material.color.getHexString();
        const roughness = material.roughness ?? 0.5;
        const metalness = material.metalness ?? 0;
        const opacity = material.opacity ?? 1;

        panel.innerHTML = `
        <div class="prop-group">
            <div class="prop-row">
                <span class="prop-label">${t('color')}</span>
                <input type="color" class="prop-input" id="mat-color" value="${color}">
            </div>
            <div class="prop-row">
                <span class="prop-label">${t('rough')}</span>
                <input type="range" class="prop-slider" id="mat-roughness" min="0" max="1" step="0.05" value="${roughness}">
                <span style="width:30px;text-align:right;font-size:10px;color:var(--text-muted)" id="mat-roughness-val">${roughness.toFixed(2)}</span>
            </div>
            <div class="prop-row">
                <span class="prop-label">${t('metal')}</span>
                <input type="range" class="prop-slider" id="mat-metalness" min="0" max="1" step="0.05" value="${metalness}">
                <span style="width:30px;text-align:right;font-size:10px;color:var(--text-muted)" id="mat-metalness-val">${metalness.toFixed(2)}</span>
            </div>
            <div class="prop-row">
                <span class="prop-label">${t('opacity')}</span>
                <input type="range" class="prop-slider" id="mat-opacity" min="0" max="1" step="0.05" value="${opacity}">
                <span style="width:30px;text-align:right;font-size:10px;color:var(--text-muted)" id="mat-opacity-val">${opacity.toFixed(2)}</span>
            </div>
        </div>
        <div class="prop-group">
            <div class="prop-group-title">${t('presets')}</div>
            <div class="material-presets">
                <div class="material-preset" data-preset="wood-light" style="background:#A0824A" title="${t('light_wood')}"></div>
                <div class="material-preset" data-preset="wood-dark" style="background:#5C4010" title="${t('dark_wood')}"></div>
                <div class="material-preset" data-preset="metal" style="background:linear-gradient(135deg,#999,#555)" title="${t('metal_preset')}"></div>
                <div class="material-preset" data-preset="white" style="background:#e8e8e8" title="${t('white')}"></div>
                <div class="material-preset" data-preset="black" style="background:#222222" title="${t('black')}"></div>
                <div class="material-preset" data-preset="red" style="background:#c0392b" title="${t('red')}"></div>
                <div class="material-preset" data-preset="blue" style="background:#2980b9" title="${t('blue')}"></div>
                <div class="material-preset" data-preset="green" style="background:#27ae60" title="${t('green')}"></div>
                <div class="material-preset" data-preset="cream" style="background:#f5e6cc" title="${t('cream')}"></div>
                <div class="material-preset" data-preset="glass" style="background:linear-gradient(135deg,#aaddff88,#ffffff33)" title="${t('glass')}"></div>
            </div>
        </div>`;

        // Bind material inputs
        const setAllMaterials = (fn) => {
            obj.traverse(child => {
                if (child.isMesh && child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(fn);
                }
            });
        };

        document.getElementById('mat-color')?.addEventListener('input', (e) => {
            setAllMaterials(m => m.color.set(e.target.value));
        });

        const bindSlider = (id, prop) => {
            const slider = document.getElementById(id);
            const valEl = document.getElementById(id + '-val');
            slider?.addEventListener('input', () => {
                const v = parseFloat(slider.value);
                setAllMaterials(m => {
                    m[prop] = v;
                    if (prop === 'opacity') {
                        m.transparent = v < 1;
                    }
                });
                if (valEl) valEl.textContent = v.toFixed(2);
            });
        };

        bindSlider('mat-roughness', 'roughness');
        bindSlider('mat-metalness', 'metalness');
        bindSlider('mat-opacity', 'opacity');

        // Presets
        const presets = {
            'wood-light': { color: 0xA0824A, roughness: 0.7, metalness: 0 },
            'wood-dark': { color: 0x5C4010, roughness: 0.7, metalness: 0 },
            'metal': { color: 0x808080, roughness: 0.3, metalness: 0.8 },
            'white': { color: 0xe8e8e8, roughness: 0.6, metalness: 0 },
            'black': { color: 0x222222, roughness: 0.5, metalness: 0.1 },
            'red': { color: 0xc0392b, roughness: 0.5, metalness: 0 },
            'blue': { color: 0x2980b9, roughness: 0.5, metalness: 0 },
            'green': { color: 0x27ae60, roughness: 0.5, metalness: 0 },
            'cream': { color: 0xf5e6cc, roughness: 0.8, metalness: 0 },
            'glass': { color: 0xaaddff, roughness: 0.05, metalness: 0.1, opacity: 0.3 },
        };

        panel.querySelectorAll('.material-preset').forEach(el => {
            el.addEventListener('click', () => {
                const p = presets[el.dataset.preset];
                if (!p) return;
                setAllMaterials(m => {
                    m.color.setHex(p.color);
                    m.roughness = p.roughness;
                    m.metalness = p.metalness;
                    if (p.opacity !== undefined) {
                        m.opacity = p.opacity;
                        m.transparent = p.opacity < 1;
                    } else {
                        m.opacity = 1;
                        m.transparent = false;
                    }
                });
                // Update inputs
                this._updateMaterialPanel(obj);
            });
        });
    }

    // ========== KEYBOARD ========== 
    _bindKeyboard() {
        window.addEventListener('keydown', (e) => {
            // Don't handle if typing in input
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            const ctrl = e.ctrlKey || e.metaKey;

            switch (e.key.toLowerCase()) {
                case 'w':
                    document.getElementById('btn-translate').click();
                    break;
                case 'e':
                    document.getElementById('btn-rotate').click();
                    break;
                case 'r':
                    document.getElementById('btn-scale').click();
                    break;
                case 'delete':
                case 'backspace':
                    this.deleteSelected();
                    e.preventDefault();
                    break;
                case 'd':
                    if (ctrl) {
                        e.preventDefault();
                        this.duplicateSelected();
                    }
                    break;
                case 'z':
                    if (ctrl) {
                        e.preventDefault();
                        if (e.shiftKey) this.redo();
                        else this.undo();
                    }
                    break;
                case 'y':
                    if (ctrl) {
                        e.preventDefault();
                        this.redo();
                    }
                    break;
                case 'f':
                    this.scene.focusSelected();
                    break;
                case 'escape':
                    this.scene.deselect();
                    break;
            }
        });
    }

    // ========== CONTEXT MENU ========== 
    _bindContextMenu() {
        this.contextMenu = null;

        this.scene.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this._removeContextMenu();

            const menu = document.createElement('div');
            menu.className = 'context-menu';
            const items = [
                { icon: 'content_copy', label: t('label_duplicate'), shortcut: 'Ctrl+D', action: () => this.duplicateSelected() },
                { icon: 'delete', label: t('label_delete'), shortcut: 'Del', action: () => this.deleteSelected() },
                null, // divider
                { icon: 'center_focus_strong', label: t('label_focus'), shortcut: 'F', action: () => this.scene.focusSelected() },
                { icon: 'restart_alt', label: t('label_reset_camera'), action: () => this.scene.resetCamera() },
            ];

            items.forEach(item => {
                if (!item) {
                    const div = document.createElement('div');
                    div.className = 'context-menu-divider';
                    menu.appendChild(div);
                    return;
                }
                const btn = document.createElement('button');
                btn.className = 'context-menu-item';
                btn.innerHTML = `<span class="material-icons-round">${item.icon}</span>${this._escapeHtml(item.label)}${item.shortcut ? `<span class="shortcut">${item.shortcut}</span>` : ''}`;
                btn.addEventListener('click', () => {
                    item.action();
                    this._removeContextMenu();
                });
                menu.appendChild(btn);
            });

            // Position
            const x = Math.min(e.clientX, window.innerWidth - 200);
            const y = Math.min(e.clientY, window.innerHeight - 200);
            menu.style.left = x + 'px';
            menu.style.top = y + 'px';
            document.body.appendChild(menu);
            this.contextMenu = menu;

            const closeHandler = (ev) => {
                if (!menu.contains(ev.target)) {
                    this._removeContextMenu();
                    document.removeEventListener('pointerdown', closeHandler);
                }
            };
            setTimeout(() => document.addEventListener('pointerdown', closeHandler), 10);
        });
    }

    _removeContextMenu() {
        if (this.contextMenu) {
            this.contextMenu.remove();
            this.contextMenu = null;
        }
    }

    // ========== VIEWPORT INFO UPDATE ========== 
    _updateLoop() {
        setInterval(() => {
            const info = this.scene.getSceneInfo();
            document.getElementById('viewport-info').textContent =
                `${t('objects')}: ${info.objects} | ${t('vertices')}: ${info.vertices.toLocaleString()}`;
        }, 500);
    }

    // ========== SERIALIZATION (for save/load) ========== 
    serializeProject() {
        return {
            version: 1,
            name: 'WebDraw Project',
            created: new Date().toISOString(),
            objects: this._serializeScene()
        };
    }

    loadProject(data) {
        if (!data || !data.objects) {
            this.toast(t('invalid_file'), 'error');
            return;
        }
        this._saveUndoState();
        this._restoreScene(data.objects);
        this.toast(t('project_loaded'), 'success');
        this.setStatus(t('project_loaded'));
    }

    newProject() {
        this._saveUndoState();
        this.scene.clearScene();
        this._updateHierarchy();
        this._updateProperties(null);
        this.toast(t('new_created'), 'success');
        this.setStatus(t('new_created'));
    }
}
