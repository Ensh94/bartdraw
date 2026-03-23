import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { t } from './i18n.js';

export class StorageManager {
    constructor(sceneManager, uiController) {
        this.scene = sceneManager;
        this.ui = uiController;
        this._bind();
    }

    _bind() {
        const $ = (id) => document.getElementById(id);

        // New project
        $('btn-new').addEventListener('click', () => this._confirmNew());

        // Save
        $('btn-save').addEventListener('click', () => this.saveProject());

        // Ctrl+S shortcut
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
                e.preventDefault();
                this.saveProject();
            }
        });

        // Load
        $('btn-load').addEventListener('click', () => $('file-input').click());
        $('file-input').addEventListener('change', (e) => this._handleFileLoad(e));

        // Export modal
        $('btn-export').addEventListener('click', () => {
            $('export-modal').style.display = 'flex';
        });
        $('export-modal-close').addEventListener('click', () => {
            $('export-modal').style.display = 'none';
        });
        $('export-modal').addEventListener('click', (e) => {
            if (e.target === $('export-modal')) $('export-modal').style.display = 'none';
        });

        // Export options
        document.querySelectorAll('.export-option').forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.dataset.format;
                this.exportAs(format);
                $('export-modal').style.display = 'none';
            });
        });
    }

    // ========== NEW PROJECT ==========
    _confirmNew() {
        if (this.scene.objects.length === 0) {
            this.ui.newProject();
            return;
        }
        this._showConfirm(
            t('new_project'),
            t('confirm_new'),
            () => this.ui.newProject()
        );
    }

    _showConfirm(title, message, onOk) {
        const modal = document.getElementById('confirm-modal');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;
        modal.style.display = 'flex';

        const okBtn = document.getElementById('confirm-ok');
        const cancelBtn = document.getElementById('confirm-cancel');

        const cleanup = () => {
            modal.style.display = 'none';
            okBtn.replaceWith(okBtn.cloneNode(true));
            cancelBtn.replaceWith(cancelBtn.cloneNode(true));
        };

        document.getElementById('confirm-ok').addEventListener('click', () => {
            cleanup();
            onOk();
        });
        document.getElementById('confirm-cancel').addEventListener('click', cleanup);
    }

    // ========== SAVE ==========
    saveProject() {
        const data = this.ui.serializeProject();
        const json = JSON.stringify(data, null, 2);
        this._downloadFile(json, 'webdraw-project.json', 'application/json');
        this.ui.toast(t('project_saved'), 'success');
        this.ui.setStatus(t('project_saved'));
    }

    // ========== LOAD ==========
    _handleFileLoad(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.ui.loadProject(data);
            } catch (err) {
                this.ui.toast(t('invalid_file'), 'error');
            }
        };
        reader.readAsText(file);
        // Reset input so same file can be loaded again
        event.target.value = '';
    }

    // ========== EXPORT ==========
    exportAs(format) {
        if (this.scene.objects.length === 0) {
            this.ui.toast(t('nothing_to_export'), 'error');
            return;
        }

        switch (format) {
            case 'gltf': this._exportGLTF(); break;
            case 'obj': this._exportOBJ(); break;
            case 'stl': this._exportSTL(); break;
            case 'json': this.saveProject(); break;
            case 'png': this._exportScreenshot(); break;
            default:
                this.ui.toast('Unknown format', 'error');
        }
    }

    _exportGLTF() {
        const exporter = new GLTFExporter();
        const exportScene = this._getExportScene();

        exporter.parse(exportScene, (result) => {
            const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
            this._downloadBlob(blob, 'webdraw-model.gltf');
            this.ui.toast(`${t('exported_as')} GLTF`, 'success');
        }, (error) => {
            this.ui.toast(`${t('export_failed')}: ${error.message}`, 'error');
        }, { binary: false });
    }

    _exportOBJ() {
        const exporter = new OBJExporter();
        const exportScene = this._getExportScene();
        const result = exporter.parse(exportScene);
        this._downloadFile(result, 'webdraw-model.obj', 'text/plain');
        this.ui.toast(`${t('exported_as')} OBJ`, 'success');
    }

    _exportSTL() {
        const exporter = new STLExporter();
        const exportScene = this._getExportScene();
        const result = exporter.parse(exportScene, { binary: true });
        const blob = new Blob([result], { type: 'application/octet-stream' });
        this._downloadBlob(blob, 'webdraw-model.stl');
        this.ui.toast(`${t('exported_as')} STL`, 'success');
    }

    _exportScreenshot() {
        const dataUrl = this.scene.takeScreenshot();
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = 'webdraw-screenshot.png';
        link.click();
        this.ui.toast(t('screenshot_saved'), 'success');
    }

    _getExportScene() {
        // Create a clean scene with just user objects
        const exportScene = new THREE.Scene();
        this.scene.objects.forEach(obj => {
            const clone = obj.clone();
            clone.traverse(child => {
                if (child.isMesh && child.material) {
                    if (Array.isArray(child.material)) {
                        child.material = child.material.map(m => m.clone());
                    } else {
                        child.material = child.material.clone();
                    }
                }
            });
            exportScene.add(clone);
        });
        return exportScene;
    }

    _downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        this._downloadBlob(blob, filename);
    }

    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
