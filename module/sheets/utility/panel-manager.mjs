// Manage the slide out an editor, menus, and tabs
export class PanelManager {
	_id = null;
	_sheet = null;
	_panel = null;

	_idMenu = null;

	_showMenu = true;
	_showPanel = false;

	_panels = {};
	_actions = {};

	get state() {
		// TODO showPanel needs to be specific per panel
		return {
			list: { ...this._panels },
			state: {
				showMenu: this._showMenu,
				showPanel: this._showPanel,
			},
		};
	}

	constructor(options = {}) {
		// Required, can not be null
		this._id = options.id;
		this._sheet = options.sheet;
		this._panels = options.panels;

		this._idMenu = `panel-menu-${this._id}`;
	}

	async onKeydown(event) {
		if (!this._showPanel) {
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			this._onEscapeDown(event);
		}
	}

	_onEscapeDown(event) {
		// Escape deselects any focused input and then closes
		if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
			document.activeElement.blur();
			this._sheet.element.focus();
			return;
		}
		// Else close any panel
		this.close();
	}

	open(key) {
		// If we have a panel close it
		if (this._showPanel) this._closePanel();
		// Then try to open the new panel and close the menu
		// else we ensure that the menu is actualy visable again
		this._openPanel(key) ? this._closeMenu() : this._openMenu();
	}

	close() {
		// If a panel is open, we open the menu
		// and in the proces hide the panel
		if (!this._showPanel) return;
		return this._openMenu();
	}

	_openMenu() {
		// When opening the menu we hide all panels
		if (this._showPanel) this._closePanel();
		document.getElementById(this._idMenu).classList.add('show');

		this._showMenu = true;
	}

	_closeMenu() {
		// Only if we have no pannel and the menu is up
		if (!this._showPanel || !this._showMenu) return;
		document.getElementById(this._idMenu).classList.remove('show');

		this._showMenu = false;
	}

	_openPanel(key) {
		if (!this._panels.hasOwnProperty(key)) return false;

		const panel = this._panels[key];
		document.getElementById(panel.id).classList.add('show');

		this._showPanel = true;
		this._panel = key;
		return true;
	}

	_closePanel() {
		const panel = this._panels[this._panel];
		document.getElementById(panel.id).classList.remove('show');

		this._showPanel = false;
	}
}
