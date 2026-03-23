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
        this._clipboard = [];
        this._buildLightingPanel();
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
        this._buildLightingPanel();
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

        // Dimensions toggle
        $('btn-dimensions').addEventListener('click', () => {
            const v = this.scene.toggleDimensions();
            $('btn-dimensions').classList.toggle('active', v);
            this.toast(t(v ? 'dims_on' : 'dims_off'), 'info');
        });

        // Add note
        $('btn-add-note').addEventListener('click', () => this._addNoteAtSelection());

        // Toggle notes visibility
        $('btn-toggle-notes').addEventListener('click', () => {
            const v = this.scene.toggleNotes();
            $('btn-toggle-notes').classList.toggle('active', v);
            this.toast(t(v ? 'notes_on' : 'notes_off'), 'info');
        });
    }

    _addNoteAtSelection() {
        let anchor;
        if (this.scene.selectedObject) {
            const box = new THREE.Box3().setFromObject(this.scene.selectedObject);
            anchor = box.getCenter(new THREE.Vector3());
            anchor.y = box.max.y;
        } else {
            anchor = new THREE.Vector3(0, 1, 0);
        }
        const offset = new THREE.Vector3(0, 0.5, 0);
        const note = this.scene.addNote(t('note_default_text'), anchor, offset);
        this.scene._editNoteInline(note);
        this._updateHierarchy();
        this.toast(t('note_added'), 'success');
    }

    // ========== OBJECT LIBRARY ========== 
    _bindLibrary() {
        document.querySelectorAll('.library-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.type;
                this.addObject(type);
            });
        });

        // Collapsible categories
        document.querySelectorAll('.category-title').forEach(title => {
            title.addEventListener('click', () => {
                title.parentElement.classList.toggle('collapsed');
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

    _copySelected() {
        if (this.scene.selectedObjects.length === 0) {
            this.toast(t('no_selection'), 'error');
            return;
        }
        this._clipboard = this._serializeScene(this.scene.selectedObjects);
        const n = this._clipboard.length;
        this.toast(`${t('copied')} ${n} ${n === 1 ? t('object') : t('objects').toLowerCase()}`, 'info');
    }

    _pasteClipboard() {
        if (!this._clipboard || this._clipboard.length === 0) return;
        this._saveUndoState();
        const newObjs = [];
        this._clipboard.forEach(s => {
            const obj = createModel(s.type, s.params);
            if (!obj) return;
            obj.userData.name = s.name + ' ' + t('copy_suffix');
            obj.position.set(s.position.x + 0.5, s.position.y, s.position.z + 0.5);
            obj.rotation.set(s.rotation.x, s.rotation.y, s.rotation.z);
            obj.scale.set(s.scale.x, s.scale.y, s.scale.z);
            if (s.material) {
                obj.traverse(child => {
                    if (child.isMesh && child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach(m => {
                            m.color.set(s.material.color);
                            m.roughness = s.material.roughness;
                            m.metalness = s.material.metalness;
                            if (s.material.opacity !== undefined) {
                                m.opacity = s.material.opacity;
                                m.transparent = s.material.opacity < 1;
                            }
                        });
                    }
                });
            }
            newObjs.push(obj);
        });
        if (newObjs.length === 0) return;
        this.scene.deselect();
        newObjs.forEach(obj => this.scene.addObject(obj, false));
        newObjs.forEach((obj, i) => this.scene.select(obj, i > 0));
        this._updateHierarchy();
        const n = newObjs.length;
        this.toast(`${t('pasted')} ${n} ${n === 1 ? t('object') : t('objects').toLowerCase()}`, 'success');
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
        const state = { objects: this._serializeScene(), notes: this._serializeNotes() };
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
        const currentState = { objects: this._serializeScene(), notes: this._serializeNotes() };
        this.redoStack.push(currentState);
        const prevState = this.undoStack.pop();
        this._restoreScene(prevState.objects || prevState);
        if (prevState.notes) this._restoreNotes(prevState.notes);
        this.toast(t('undo_msg'), 'info');
    }

    redo() {
        if (this.redoStack.length === 0) {
            this.toast(t('nothing_redo'), 'info');
            return;
        }
        const currentState = { objects: this._serializeScene(), notes: this._serializeNotes() };
        this.undoStack.push(currentState);
        const nextState = this.redoStack.pop();
        this._restoreScene(nextState.objects || nextState);
        if (nextState.notes) this._restoreNotes(nextState.notes);
        this.toast(t('redo_msg'), 'info');
    }

    _serializeScene(objs) {
        return (objs || this.scene.objects).map(obj => {
            // Capture material overrides from first mesh
            let material = null;
            obj.traverse(child => {
                if (child.isMesh && child.material && !material) {
                    const m = Array.isArray(child.material) ? child.material[0] : child.material;
                    material = {
                        color: '#' + m.color.getHexString(),
                        roughness: m.roughness,
                        metalness: m.metalness,
                        opacity: m.opacity,
                    };
                }
            });
            return {
                type: obj.userData.type,
                name: obj.userData.name,
                params: { ...obj.userData.params },
                position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
                rotation: { x: obj.rotation.x, y: obj.rotation.y, z: obj.rotation.z },
                scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
                material,
            };
        });
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
            // Restore material overrides
            if (s.material) {
                obj.traverse(child => {
                    if (child.isMesh && child.material) {
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach(m => {
                            m.color.set(s.material.color);
                            m.roughness = s.material.roughness;
                            m.metalness = s.material.metalness;
                            if (s.material.opacity !== undefined) {
                                m.opacity = s.material.opacity;
                                m.transparent = s.material.opacity < 1;
                            }
                        });
                    }
                });
            }
            this.scene.addObject(obj);
        });
        this.scene.deselect();
        this._updateHierarchy();
    }

    _serializeNotes() {
        return this.scene.notes.map(n => ({
            text: n.text,
            anchor: { x: n.anchor.x, y: n.anchor.y, z: n.anchor.z },
            labelPos: { x: n.labelPos.x, y: n.labelPos.y, z: n.labelPos.z }
        }));
    }

    _restoreNotes(notesArr) {
        this.scene.clearNotes();
        notesArr.forEach(n => {
            const anchor = new THREE.Vector3(n.anchor.x, n.anchor.y, n.anchor.z);
            const offset = new THREE.Vector3(
                n.labelPos.x - n.anchor.x,
                n.labelPos.y - n.anchor.y,
                n.labelPos.z - n.anchor.z
            );
            this.scene.addNote(n.text, anchor, offset);
        });
    }

    // ========== HIERARCHY ========== 
    _updateHierarchy() {
        const panel = document.getElementById('scene-hierarchy');
        if (this.scene.objects.length === 0 && this.scene.notes.length === 0) {
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

        // Notes in hierarchy
        this.scene.notes.forEach((note) => {
            const item = document.createElement('div');
            item.className = 'hierarchy-item hierarchy-note';
            const preview = note.text.length > 20 ? note.text.substring(0, 20) + '…' : note.text;
            item.innerHTML = `
                <span class="material-icons-round" style="color:#ffcc00">sticky_note_2</span>
                <span class="item-name">${this._escapeHtml(preview)}</span>
                <span class="material-icons-round item-delete-note" title="${t('delete_note')}">close</span>`;
            item.querySelector('.item-name').addEventListener('click', () => {
                this.scene._editNoteInline(note);
            });
            item.querySelector('.item-delete-note').addEventListener('click', (e) => {
                e.stopPropagation();
                this.scene.removeNote(note);
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

            // Shelf position editor for types that support it
            if (ud.params?.shelfPositions && ud.params.shelfPositions.length > 0) {
                html += this._shelfEditorSection(ud);
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
                // When shelf count changes, reset custom positions so they regenerate evenly
                if (key === 'shelves') {
                    delete params.shelfPositions;
                }
                const pos = obj.position.clone();
                const rot = obj.rotation.clone();
                const scale = obj.scale.clone();
                const name = obj.userData.name;
                const type = obj.userData.type;
                const mat = this._captureMaterial(obj);

                this.scene.removeObject(obj);
                const newObj = createModel(type, params);
                if (newObj) {
                    newObj.position.copy(pos);
                    newObj.rotation.copy(rot);
                    newObj.scale.copy(scale);
                    newObj.userData.name = name;
                    if (mat) this._applyMaterial(newObj, mat);
                    this.scene.addObject(newObj);
                    this._updateHierarchy();
                }
            });
        });

        // Bind shelf position editor
        this._bindShelfEditor(obj);

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

    _shelfEditorSection(ud) {
        const positions = ud.params.shelfPositions;
        const objHeight = ud.params.height || 1;
        const thick = 0.02;
        const innerH = objHeight - 2 * thick;

        let html = `<div class="prop-group"><div class="prop-group-title">${t('shelf_positions')}</div>`;
        html += `<div class="shelf-editor-hint">${t('shelf_edit_hint')}</div>`;
        positions.forEach((pos, i) => {
            const cm = (pos * 100).toFixed(0);
            const maxCm = (innerH * 100).toFixed(0);
            html += `<div class="shelf-editor-row">
                <span class="shelf-label">${t('shelf_n')} ${i + 1}</span>
                <input type="range" class="shelf-slider" data-shelf-idx="${i}" 
                    min="2" max="${maxCm}" value="${cm}" step="1">
                <input type="number" class="shelf-value" id="shelf-val-${i}" data-shelf-input="${i}"
                    min="2" max="${maxCm}" value="${cm}" step="1">
            </div>`;
        });
        html += '</div>';
        return html;
    }

    _bindShelfEditor(obj) {
        const sliders = document.querySelectorAll('[data-shelf-idx]');
        if (sliders.length === 0) return;

        sliders.forEach(slider => {
            const idx = parseInt(slider.dataset.shelfIdx, 10);
            const valInput = document.getElementById(`shelf-val-${idx}`);

            // Slider → number input sync (live)
            slider.addEventListener('input', () => {
                if (valInput) valInput.value = slider.value;
            });

            const applyChange = (cmValue) => {
                const cm = Math.max(2, Math.min(parseInt(slider.max, 10), parseInt(cmValue, 10)));
                slider.value = cm;
                if (valInput) valInput.value = cm;
                this._saveUndoState();
                const meters = cm / 100;
                const positions = [...obj.userData.params.shelfPositions];
                positions[idx] = meters;
                positions.sort((a, b) => a - b);
                const params = { ...obj.userData.params, shelfPositions: positions };
                const pos = obj.position.clone();
                const rot = obj.rotation.clone();
                const scale = obj.scale.clone();
                const name = obj.userData.name;
                const type = obj.userData.type;
                const mat = this._captureMaterial(obj);
                this.scene.removeObject(obj);
                const newObj = createModel(type, params);
                if (newObj) {
                    newObj.position.copy(pos);
                    newObj.rotation.copy(rot);
                    newObj.scale.copy(scale);
                    newObj.userData.name = name;
                    if (mat) this._applyMaterial(newObj, mat);
                    this.scene.addObject(newObj);
                    this._updateHierarchy();
                }
            };

            slider.addEventListener('change', () => applyChange(slider.value));

            // Number input → apply on Enter or blur
            if (valInput) {
                valInput.addEventListener('input', () => { slider.value = valInput.value; });
                valInput.addEventListener('change', () => applyChange(valInput.value));
                valInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyChange(valInput.value); } });
            }
        });
    }

    _captureMaterial(obj) {
        let mat = null;
        obj.traverse(child => {
            if (child.isMesh && child.material && !mat) {
                const m = Array.isArray(child.material) ? child.material[0] : child.material;
                mat = { color: '#' + m.color.getHexString(), roughness: m.roughness, metalness: m.metalness, opacity: m.opacity };
            }
        });
        return mat;
    }

    _applyMaterial(obj, mat) {
        obj.traverse(child => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(m => {
                    m.color.set(mat.color);
                    m.roughness = mat.roughness;
                    m.metalness = mat.metalness;
                    if (mat.opacity !== undefined) { m.opacity = mat.opacity; m.transparent = mat.opacity < 1; }
                });
            }
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
                case 'c':
                    if (ctrl) {
                        e.preventDefault();
                        this._copySelected();
                    }
                    break;
                case 'v':
                    if (ctrl) {
                        e.preventDefault();
                        this._pasteClipboard();
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

    // ========== LIGHTING PANEL ==========
    _buildLightingPanel() {
        const panel = document.getElementById('lighting-panel');
        const s = this.scene.getLightSettings();

        const row = (label, id, type, min, max, step, value, extra = '') => {
            if (type === 'color') {
                return `<div class="prop-row">
                    <span class="prop-label">${label}</span>
                    <input type="color" class="prop-input" id="${id}" value="${value}">
                </div>`;
            }
            if (type === 'checkbox') {
                return `<div class="prop-row">
                    <span class="prop-label">${label}</span>
                    <label class="light-toggle"><input type="checkbox" id="${id}" ${value ? 'checked' : ''}><span class="light-toggle-slider"></span></label>
                </div>`;
            }
            return `<div class="prop-row">
                <span class="prop-label">${label}</span>
                <input type="range" class="prop-slider" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">
                <span style="width:30px;text-align:right;font-size:10px;color:var(--text-muted)" id="${id}-val">${Number(value).toFixed(2)}</span>
            </div>`;
        };

        panel.innerHTML = `
        <div class="prop-group">
            <div class="prop-group-title">${t('light_ambient')}</div>
            ${row(t('intensity'), 'light-ambient-int', 'range', 0, 3, 0.05, s.ambientIntensity)}
            ${row(t('color'), 'light-ambient-color', 'color', 0, 0, 0, s.ambientColor)}
            ${row(t('light_hemi'), 'light-hemi-int', 'range', 0, 2, 0.05, s.hemiIntensity)}
        </div>
        <div class="prop-group">
            <div class="prop-group-title">${t('light_key')}</div>
            ${row(t('intensity'), 'light-key-int', 'range', 0, 5, 0.1, s.keyIntensity)}
            ${row(t('color'), 'light-key-color', 'color', 0, 0, 0, s.keyColor)}
            ${row('X', 'light-key-x', 'range', -20, 20, 0.5, s.keyX)}
            ${row('Y', 'light-key-y', 'range', 0, 30, 0.5, s.keyY)}
            ${row('Z', 'light-key-z', 'range', -20, 20, 0.5, s.keyZ)}
        </div>
        <div class="prop-group">
            <div class="prop-group-title">${t('light_fill_rim')}</div>
            ${row(t('light_fill'), 'light-fill-int', 'range', 0, 3, 0.05, s.fillIntensity)}
            ${row(t('light_rim'), 'light-rim-int', 'range', 0, 3, 0.05, s.rimIntensity)}
        </div>
        <div class="prop-group">
            <div class="prop-group-title">${t('light_rendering')}</div>
            ${row(t('light_exposure'), 'light-exposure', 'range', 0.2, 3, 0.05, s.exposure)}
            ${row(t('light_shadows'), 'light-shadows', 'checkbox', 0, 0, 0, s.shadowsEnabled)}
        </div>
        <div class="prop-group" style="text-align:center">
            <button class="light-preset-btn" id="light-preset-bright">${t('light_preset_bright')}</button>
            <button class="light-preset-btn" id="light-preset-soft">${t('light_preset_soft')}</button>
            <button class="light-preset-btn" id="light-preset-dark">${t('light_preset_dark')}</button>
        </div>`;

        // Bind sliders
        const bindRange = (id, key) => {
            const el = document.getElementById(id);
            const valEl = document.getElementById(id + '-val');
            el?.addEventListener('input', () => {
                const v = parseFloat(el.value);
                this.scene.setLightSettings({ [key]: v });
                if (valEl) valEl.textContent = v.toFixed(2);
            });
        };
        const bindColor = (id, key) => {
            document.getElementById(id)?.addEventListener('input', (e) => {
                this.scene.setLightSettings({ [key]: e.target.value });
            });
        };

        bindRange('light-ambient-int', 'ambientIntensity');
        bindColor('light-ambient-color', 'ambientColor');
        bindRange('light-hemi-int', 'hemiIntensity');
        bindRange('light-key-int', 'keyIntensity');
        bindColor('light-key-color', 'keyColor');
        bindRange('light-key-x', 'keyX');
        bindRange('light-key-y', 'keyY');
        bindRange('light-key-z', 'keyZ');
        bindRange('light-fill-int', 'fillIntensity');
        bindRange('light-rim-int', 'rimIntensity');
        bindRange('light-exposure', 'exposure');

        document.getElementById('light-shadows')?.addEventListener('change', (e) => {
            this.scene.setLightSettings({ shadowsEnabled: e.target.checked });
        });

        // Presets
        const applyPreset = (settings) => {
            this.scene.setLightSettings(settings);
            this._buildLightingPanel();
        };
        document.getElementById('light-preset-bright')?.addEventListener('click', () => {
            applyPreset({ ambientIntensity: 1.2, ambientColor: '#ffffff', hemiIntensity: 0.6, keyIntensity: 2.0, keyColor: '#ffffff', keyX: 8, keyY: 12, keyZ: 6, fillIntensity: 0.6, rimIntensity: 0.3, exposure: 1.2, shadowsEnabled: true });
        });
        document.getElementById('light-preset-soft')?.addEventListener('click', () => {
            applyPreset({ ambientIntensity: 0.8, ambientColor: '#c8d0e0', hemiIntensity: 0.6, keyIntensity: 0.8, keyColor: '#ffeedd', keyX: 5, keyY: 10, keyZ: 4, fillIntensity: 0.4, rimIntensity: 0.2, exposure: 1.0, shadowsEnabled: false });
        });
        document.getElementById('light-preset-dark')?.addEventListener('click', () => {
            applyPreset({ ambientIntensity: 0.2, ambientColor: '#303850', hemiIntensity: 0.1, keyIntensity: 1.5, keyColor: '#ffeedd', keyX: 8, keyY: 12, keyZ: 6, fillIntensity: 0.1, rimIntensity: 0.1, exposure: 0.8, shadowsEnabled: true });
        });
    }

    // ========== CONTEXT MENU ========== 
    _bindContextMenu() {
        this.contextMenu = null;
        this._rmbDragStart = null;
        this._rmbDragged = false;

        // Track whether RMB was actually dragged (for pan) vs just clicked
        this.scene.canvas.addEventListener('pointerdown', (e) => {
            if (e.button === 2) {
                this._rmbDragStart = { x: e.clientX, y: e.clientY };
                this._rmbDragged = false;
            }
        });
        this.scene.canvas.addEventListener('pointermove', (e) => {
            if (this._rmbDragStart && e.buttons & 2) {
                const dx = e.clientX - this._rmbDragStart.x;
                const dy = e.clientY - this._rmbDragStart.y;
                if (dx * dx + dy * dy > 16) this._rmbDragged = true;
            }
        });

        this.scene.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // Suppress menu if RMB was used to pan
            if (this._rmbDragged) { this._rmbDragStart = null; this._rmbDragged = false; return; }
            this._rmbDragStart = null;
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
            name: 'BartDraw Project',
            created: new Date().toISOString(),
            objects: this._serializeScene(),
            notes: this._serializeNotes(),
            lighting: this.scene.getLightSettings()
        };
    }

    loadProject(data) {
        if (!data || !data.objects) {
            this.toast(t('invalid_file'), 'error');
            return;
        }
        this._saveUndoState();
        this._restoreScene(data.objects);
        if (data.notes) this._restoreNotes(data.notes);
        if (data.lighting) {
            this.scene.setLightSettings(data.lighting);
            this._buildLightingPanel();
        }
        this.toast(t('project_loaded'), 'success');
        this.setStatus(t('project_loaded'));
    }

    newProject() {
        this._saveUndoState();
        this.scene.clearScene();
        this.scene.clearNotes();
        this._updateHierarchy();
        this._updateProperties(null);
        try { localStorage.removeItem('webdraw_autosave'); } catch (e) { /* ignore */ }
        this.toast(t('new_created'), 'success');
        this.setStatus(t('new_created'));
    }
}
