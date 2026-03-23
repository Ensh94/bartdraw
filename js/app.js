import { SceneManager } from './scene.js';
import { UIController } from './ui.js';
import { StorageManager } from './storage.js';
import { t, getLang, setLang, onLangChange } from './i18n.js';

class App {
    constructor() {
        try {
            const canvas = document.getElementById('viewport');
            this.scene = new SceneManager(canvas);
            this.ui = new UIController(this.scene);
            this.storage = new StorageManager(this.scene, this.ui);

            this._initLangPicker();

            this.ui.setStatus(t('ready_hint'));
            this.ui.toast(t('welcome'), 'info');

            // Auto-save to localStorage every 30s
            this._autoSaveInterval = setInterval(() => this._autoSave(), 30000);

            // Save immediately when objects change (debounced 2s)
            this._debouncedSave = null;
            const scheduleQuickSave = () => {
                clearTimeout(this._debouncedSave);
                this._debouncedSave = setTimeout(() => this._autoSave(), 2000);
            };
            const origObjChange = this.scene.onObjectsChange;
            this.scene.onObjectsChange = () => {
                if (origObjChange) origObjChange();
                scheduleQuickSave();
            };
            const origSelChange = this.scene.onSelectionChange;
            this.scene.onSelectionChange = (obj) => {
                if (origSelChange) origSelChange(obj);
                scheduleQuickSave();
            };

            // Save on page unload
            window.addEventListener('beforeunload', () => this._autoSave());

            this._tryAutoLoad();
        } catch (err) {
            console.error('App initialization failed:', err);
            document.getElementById('status-message').textContent = 'Error: ' + err.message;
        }
    }

    _initLangPicker() {
        const picker = document.getElementById('lang-picker');
        const currentLang = getLang();
        
        // Set initial active state
        picker.querySelectorAll('.lang-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.lang === currentLang);
            btn.addEventListener('click', () => {
                setLang(btn.dataset.lang);
            });
        });

        onLangChange((lang) => {
            picker.querySelectorAll('.lang-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.lang === lang);
            });
        });

        // Apply immediately on load if not English
        if (currentLang !== 'en') {
            // Trigger language application
            setLang(currentLang);
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
                    this.ui.toast(t('autosave_restored'), 'info');
                    this.ui.setStatus(t('autosave_restored'));
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
