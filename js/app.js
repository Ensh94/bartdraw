import { SceneManager } from './scene.js';
import { UIController } from './ui.js';
import { StorageManager } from './storage.js';

class App {
    constructor() {
        try {
            const canvas = document.getElementById('viewport');
            this.scene = new SceneManager(canvas);
            this.ui = new UIController(this.scene);
            this.storage = new StorageManager(this.scene, this.ui);

            this.ui.setStatus('Ready - click an object in the library to add it to the scene');
            this.ui.toast('Welcome to WebDraw 3D! Add objects from the library on the left.', 'info');

            // Auto-save to localStorage every 30s
            this._autoSaveInterval = setInterval(() => this._autoSave(), 30000);
            this._tryAutoLoad();
        } catch (err) {
            console.error('App initialization failed:', err);
            document.getElementById('status-message').textContent = 'Error: ' + err.message;
        }
    }

    _autoSave() {
        if (this.scene.objects.length === 0) return;
        try {
            const data = this.ui.serializeProject();
            localStorage.setItem('webdraw_autosave', JSON.stringify(data));
        } catch (e) {
            // localStorage might be full, ignore silently
        }
    }

    _tryAutoLoad() {
        try {
            const saved = localStorage.getItem('webdraw_autosave');
            if (saved) {
                const data = JSON.parse(saved);
                if (data && data.objects && data.objects.length > 0) {
                    this.ui.loadProject(data);
                    this.ui.toast('Auto-saved project restored', 'info');
                    this.ui.setStatus('Auto-saved project restored');
                }
            }
        } catch (e) {
            // Ignore corrupted auto-save
        }
    }
}

// Boot
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
