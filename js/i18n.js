const translations = {
    en: {
        // Toolbar titles
        'new_project': 'New Project',
        'save_project': 'Save Project',
        'load_project': 'Load Project',
        'export_model': 'Export 3D Model',
        'move': 'Move (W)',
        'rotate': 'Rotate (E)',
        'scale': 'Scale (R)',
        'duplicate': 'Duplicate (Ctrl+D)',
        'delete': 'Delete (Del)',
        'undo': 'Undo (Ctrl+Z)',
        'redo': 'Redo (Ctrl+Y)',
        'toggle_grid': 'Toggle Grid',
        'toggle_snap': 'Toggle Snap',
        'reset_camera': 'Reset Camera',

        // Labels (short, no shortcut)
        'label_scale': 'Scale',
        'label_rotation': 'Rotation',
        'label_duplicate': 'Duplicate',
        'label_delete': 'Delete',
        'label_focus': 'Focus',
        'label_reset_camera': 'Reset Camera',

        // Panels
        'object_library': 'Object Library',
        'scene_hierarchy': 'Scene Hierarchy',
        'properties': 'Properties',
        'material': 'Material',
        'parameters': 'Parameters',
        'transform': 'Transform',
        'presets': 'Presets',

        // Categories
        'cat_furniture': 'Furniture',
        'cat_architecture': 'Architecture',
        'cat_primitives': 'Primitives',

        // Objects
        'cabinet': 'Cabinet',
        'locker': 'Locker',
        'shelf': 'Shelf Unit',
        'drawer-unit': 'Drawers',
        'desk': 'Desk',
        'table': 'Table',
        'bookcase': 'Bookcase',
        'wardrobe': 'Wardrobe',
        'room': 'Room',
        'wall': 'Wall',
        'floor': 'Floor',
        'door-frame': 'Door',
        'box': 'Box',
        'cylinder': 'Cylinder',
        'sphere': 'Sphere',
        'plane': 'Plane',

        // Properties labels
        'width': 'Width',
        'height': 'Height',
        'depth': 'Depth',
        'shelves': 'Shelves',
        'doors': 'Doors',
        'color': 'Color',
        'cell_width': 'Cell Width',
        'rows': 'Rows',
        'columns': 'Columns',
        'drawers': 'Drawers',
        'thickness': 'Thickness',
        'frame_width': 'Frame Width',
        'handle_side': 'Handle Side',
        'radius': 'Radius',
        'wall_color': 'Wall Color',
        'floor_color': 'Floor Color',
        'position': 'Position',
        'rotation': 'Rotation',

        // Material
        'rough': 'Rough',
        'metal': 'Metal',
        'opacity': 'Opacity',
        'light_wood': 'Light Wood',
        'dark_wood': 'Dark Wood',
        'metal_preset': 'Metal',
        'white': 'White',
        'black': 'Black',
        'red': 'Red',
        'blue': 'Blue',
        'green': 'Green',
        'cream': 'Cream',
        'glass': 'Glass',

        // Status
        'ready': 'Ready',
        'translate': 'Translate',
        'snap_on': 'Snap: On',
        'snap_off': 'Snap: Off',
        'grid_on': 'Grid: On',
        'grid_off': 'Grid: Off',
        'dims_on': 'Dimensions: On',
        'dims_off': 'Dimensions: Off',
        'toggle_dimensions': 'Show/Hide Dimensions',

        // Empty states
        'no_objects': 'No objects in scene',
        'select_to_edit': 'Select an object to edit its properties',
        'select_for_material': 'Select an object to edit materials',
        'no_material': 'No editable material',

        // Messages
        'welcome': 'Welcome to WebDraw 3D! Add objects from the library on the left.',
        'ready_hint': 'Ready - click an object in the library to add it to the scene',
        'added': 'Added',
        'deleted': 'Deleted',
        'duplicated': 'Object duplicated',
        'copied': 'Copied',
        'pasted': 'Pasted',
        'object': 'object',
        'no_selection': 'No object selected',
        'nothing_undo': 'Nothing to undo',
        'nothing_redo': 'Nothing to redo',
        'undo_msg': 'Undo',
        'redo_msg': 'Redo',
        'project_loaded': 'Project loaded',
        'project_saved': 'Project saved',
        'new_created': 'New project created',
        'autosave_restored': 'Auto-saved project restored',
        'invalid_file': 'Failed to load file: Invalid format',
        'nothing_to_export': 'Nothing to export - add some objects first',
        'exported_as': 'Exported as',
        'export_failed': 'Export failed',
        'screenshot_saved': 'Screenshot saved',

        // Export modal
        'export_project': 'Export Project',
        'gltf_name': 'GLTF / GLB',
        'gltf_desc': 'Standard 3D format, compatible with most software',
        'obj_name': 'OBJ',
        'obj_desc': 'Wavefront OBJ, widely supported legacy format',
        'stl_name': 'STL',
        'stl_desc': 'For 3D printing',
        'json_name': 'WebDraw JSON',
        'json_desc': 'Project file, can be loaded back into WebDraw',
        'png_name': 'Screenshot (PNG)',
        'png_desc': 'High-resolution render of current viewport',

        // Confirm modal
        'confirm': 'Confirm',
        'cancel': 'Cancel',
        'ok': 'OK',
        'confirm_new': 'Are you sure you want to start a new project? Unsaved changes will be lost.',

        // Context menu
        'focus': 'Focus',
        'copy_suffix': '(copy)',

        // Shelf editor
        'shelf_positions': 'SHELF POSITIONS',
        'shelf_edit_hint': 'Drag sliders to adjust individual shelf heights',
        'shelf_n': 'Shelf',

        // Viewport
        'objects': 'Objects',
        'objects_selected': 'objects selected',
        'multi_select_hint': 'Use the transform gizmo to move/rotate/scale all selected objects together',
        'vertices': 'Vertices',

        // Notes
        'add_note': 'Add Note',
        'note_added': 'Note added',
        'note_default_text': 'Note',
        'delete_note': 'Delete note',
        'toggle_notes': 'Show/Hide Notes',
        'notes_on': 'Notes: On',
        'notes_off': 'Notes: Off',

        // Lighting
        'lighting': 'Lighting',
        'intensity': 'Intensity',
        'light_ambient': 'Ambient',
        'light_hemi': 'Hemisphere',
        'light_key': 'Key Light',
        'light_fill_rim': 'Fill & Rim',
        'light_fill': 'Fill',
        'light_rim': 'Rim',
        'light_rendering': 'Rendering',
        'light_exposure': 'Exposure',
        'light_shadows': 'Shadows',
        'light_preset_bright': 'Bright',
        'light_preset_soft': 'Soft',
        'light_preset_dark': 'Dark',
    },

    pl: {
        // Toolbar titles
        'new_project': 'Nowy projekt',
        'save_project': 'Zapisz projekt',
        'load_project': 'Wczytaj projekt',
        'export_model': 'Eksportuj model 3D',
        'move': 'Przesuń (W)',
        'rotate': 'Obróć (E)',
        'scale': 'Skaluj (R)',
        'duplicate': 'Duplikuj (Ctrl+D)',
        'delete': 'Usuń (Del)',
        'undo': 'Cofnij (Ctrl+Z)',
        'redo': 'Ponów (Ctrl+Y)',
        'toggle_grid': 'Pokaż/ukryj siatkę',
        'toggle_snap': 'Przyciąganie',
        'reset_camera': 'Resetuj kamerę',

        // Labels (short, no shortcut)
        'label_scale': 'Skala',
        'label_rotation': 'Rotacja',
        'label_duplicate': 'Duplikuj',
        'label_delete': 'Usuń',
        'label_focus': 'Przybliż',
        'label_reset_camera': 'Resetuj kamerę',

        // Panels
        'object_library': 'Biblioteka obiektów',
        'scene_hierarchy': 'Hierarchia sceny',
        'properties': 'Właściwości',
        'material': 'Materiał',
        'parameters': 'Parametry',
        'transform': 'Transformacja',
        'presets': 'Gotowe materiały',

        // Categories
        'cat_furniture': 'Meble',
        'cat_architecture': 'Architektura',
        'cat_primitives': 'Prymitywy',

        // Objects
        'cabinet': 'Szafka',
        'locker': 'Szafka metalowa',
        'shelf': 'Regał',
        'drawer-unit': 'Komoda',
        'desk': 'Biurko',
        'table': 'Stół',
        'bookcase': 'Biblioteczka',
        'wardrobe': 'Szafa',
        'room': 'Pokój',
        'wall': 'Ściana',
        'floor': 'Podłoga',
        'door-frame': 'Drzwi',
        'box': 'Sześcian',
        'cylinder': 'Walec',
        'sphere': 'Kula',
        'plane': 'Płaszczyzna',

        // Properties labels
        'width': 'Szerokość',
        'height': 'Wysokość',
        'depth': 'Głębokość',
        'shelves': 'Półki',
        'doors': 'Drzwi',
        'color': 'Kolor',
        'cell_width': 'Szer. komórki',
        'rows': 'Rzędy',
        'columns': 'Kolumny',
        'drawers': 'Szuflady',
        'thickness': 'Grubość',
        'frame_width': 'Szer. ramy',
        'handle_side': 'Strona klamki',
        'radius': 'Promień',
        'wall_color': 'Kolor ściany',
        'floor_color': 'Kolor podłogi',
        'position': 'Pozycja',
        'rotation': 'Rotacja',

        // Material
        'rough': 'Szorst.',
        'metal': 'Metal',
        'opacity': 'Przezr.',
        'light_wood': 'Jasne drewno',
        'dark_wood': 'Ciemne drewno',
        'metal_preset': 'Metal',
        'white': 'Biały',
        'black': 'Czarny',
        'red': 'Czerwony',
        'blue': 'Niebieski',
        'green': 'Zielony',
        'cream': 'Kremowy',
        'glass': 'Szkło',

        // Status
        'ready': 'Gotowy',
        'translate': 'Przesuwanie',
        'snap_on': 'Przyciąganie: Wł.',
        'snap_off': 'Przyciąganie: Wył.',
        'grid_on': 'Siatka: Wł.',
        'grid_off': 'Siatka: Wył.',
        'dims_on': 'Wymiary: Wł.',
        'dims_off': 'Wymiary: Wył.',
        'toggle_dimensions': 'Pokaż/ukryj wymiary',

        // Empty states
        'no_objects': 'Brak obiektów na scenie',
        'select_to_edit': 'Wybierz obiekt, aby edytować właściwości',
        'select_for_material': 'Wybierz obiekt, aby edytować materiał',
        'no_material': 'Brak edytowalnego materiału',

        // Messages
        'welcome': 'Witaj w WebDraw 3D! Dodaj obiekty z biblioteki po lewej.',
        'ready_hint': 'Gotowy - kliknij obiekt w bibliotece, aby dodać go do sceny',
        'added': 'Dodano',
        'deleted': 'Usunięto',
        'duplicated': 'Obiekt zduplikowany',
        'copied': 'Skopiowano',
        'pasted': 'Wklejono',
        'object': 'obiekt',
        'no_selection': 'Nie wybrano obiektu',
        'nothing_undo': 'Brak operacji do cofnięcia',
        'nothing_redo': 'Brak operacji do ponowienia',
        'undo_msg': 'Cofnięto',
        'redo_msg': 'Ponowiono',
        'project_loaded': 'Wczytano projekt',
        'project_saved': 'Zapisano projekt',
        'new_created': 'Utworzono nowy projekt',
        'autosave_restored': 'Przywrócono autozapis',
        'invalid_file': 'Nie udało się wczytać pliku: Nieprawidłowy format',
        'nothing_to_export': 'Brak obiektów do eksportu - dodaj najpierw obiekty',
        'exported_as': 'Wyeksportowano jako',
        'export_failed': 'Eksport nie powiódł się',
        'screenshot_saved': 'Zrzut ekranu zapisany',

        // Export modal
        'export_project': 'Eksportuj projekt',
        'gltf_name': 'GLTF / GLB',
        'gltf_desc': 'Standardowy format 3D, kompatybilny z większością programów',
        'obj_name': 'OBJ',
        'obj_desc': 'Wavefront OBJ, szeroko wspierany format',
        'stl_name': 'STL',
        'stl_desc': 'Do druku 3D',
        'json_name': 'WebDraw JSON',
        'json_desc': 'Plik projektu, można wczytać z powrotem do WebDraw',
        'png_name': 'Zrzut ekranu (PNG)',
        'png_desc': 'Render widoku w wysokiej rozdzielczości',

        // Confirm modal
        'confirm': 'Potwierdź',
        'cancel': 'Anuluj',
        'ok': 'OK',
        'confirm_new': 'Czy na pewno chcesz rozpocząć nowy projekt? Niezapisane zmiany zostaną utracone.',

        // Shelf editor
        'shelf_positions': 'POZYCJE PÓŁEK',
        'shelf_edit_hint': 'Przeciągnij suwaki, aby dostosować wysokość każdej półki',
        'shelf_n': 'Półka',

        // Context menu
        'focus': 'Przybliż',
        'copy_suffix': '(kopia)',

        // Viewport
        'objects': 'Obiekty',
        'objects_selected': 'obiektów zaznaczonych',
        'multi_select_hint': 'Użyj narzędzia transformacji aby przesunąć/obrócić/skalować wszystkie zaznaczone obiekty razem',
        'vertices': 'Wierzchołki',

        // Notes
        'add_note': 'Dodaj notatkę',
        'note_added': 'Notatka dodana',
        'note_default_text': 'Notatka',
        'delete_note': 'Usuń notatkę',
        'toggle_notes': 'Pokaż/Ukryj notatki',
        'notes_on': 'Notatki: Wł.',
        'notes_off': 'Notatki: Wył.',

        // Lighting
        'lighting': 'Oświetlenie',
        'intensity': 'Intensywność',
        'light_ambient': 'Otoczenie',
        'light_hemi': 'Hemisfera',
        'light_key': 'Światło główne',
        'light_fill_rim': 'Wypełnienie i krawędź',
        'light_fill': 'Wypełnienie',
        'light_rim': 'Krawędź',
        'light_rendering': 'Renderowanie',
        'light_exposure': 'Ekspozycja',
        'light_shadows': 'Cienie',
        'light_preset_bright': 'Jasne',
        'light_preset_soft': 'Miękkie',
        'light_preset_dark': 'Ciemne',
    }
};

let currentLang = localStorage.getItem('webdraw_lang') || 'en';
const listeners = [];

export function t(key) {
    return translations[currentLang]?.[key] || translations['en']?.[key] || key;
}

export function getLang() {
    return currentLang;
}

export function setLang(lang) {
    if (!translations[lang]) return;
    currentLang = lang;
    localStorage.setItem('webdraw_lang', lang);
    listeners.forEach(fn => fn(lang));
}

export function onLangChange(fn) {
    listeners.push(fn);
}
