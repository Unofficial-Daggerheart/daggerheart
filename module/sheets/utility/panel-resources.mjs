// Manage and track various resources on sheets
export class ResourcesPanel {
	_id = null;
	_sheet = null;

	_list = [];
	_state = {};

	get state() {
		return {
			list: this._list,
			...this._state,
		};
	}

	get id() {
		return this._id;
	}

	get resources() {
		return this._list;
	}

	get element_id() {
		return `panel-resources-${this._id}`;
	}

	get _default() {
		return {
			id: `tracker-${Math.random().toString(12)}`,
			name: 'Tracker',
			color: '#f3c267',
			max: 1,
			value: 0,
			order: this._list.length,
		};
	}

	constructor(options = {}) {
		// Required, can not be null
		this._id = options.id;
		this._sheet = options.sheet;
		this._onSave = options.onSave;

		this._list = options.resources;
		this._state = {
			next: this._default,
		};
	}

	async open() {
		let elm = document.getElementById(`panel-menu-${this._id}`);
		if (elm !== null) elm.classList.add('hide');
		elm = document.getElementById(`tracker-panel-${this._id}`);
		if (elm !== null) elm.classList.add('show');
		this._state.display = 'flex';
	}

	async close() {
		let elm = document.getElementById(`panel-menu-${this._id}`);
		if (elm !== null) elm.classList.remove('hide');
		elm = document.getElementById(`tracker-panel-${this._id}`);
		if (elm !== null) elm.classList.remove('show');
		this._state.display = 'none';
	}

	async create() {
		const resource = {
			id: this._state.next.id,
			name: this._state.next.name,
			color: this._state.next.color,
			max: this._state.next.max,
			value: this._state.next.value,
			order: this._list.length,
		};

		this._list.push(resource);
		await this._onSave(this._list);
		this._state.next = this._default;

		// Grab the focus of the name input to create new elements
		const overlay = document.getElementById(`panel-resources-${this._id}`);
		overlay.querySelector('.ress-next-name').focus();
	}

	async delete(index) {
		if (index < 0 || index >= this._list.length) {
			ui.notifications.error('Failed to delete the resource.');
			return;
		}

		this._list.splice(index, 1);
		await this._sheet.render();
		await this._onSave(this._list);

		// Grab the focus of the name input to create new elements
		const overlay = document.getElementById(`panel-resources-${this._id}`);
		overlay.querySelector('.ress-next-name').focus();
	}

	async increase(index) {
		if (index < 0 || index >= this._list.length) {
			ui.notifications.error('Failed to increase the resource value.');
			return;
		}
		const resource = this._list[index];
		this._list[index].value = Math.min(resource.value + 1, resource.max);
		await this._onSave(this._list);
	}

	async decrease(index) {
		if (index < 0 || index >= this._list.length) {
			ui.notifications.error('Failed to decrease the resource value.');
			return;
		}
		const resource = this._list[index];
		this._list[index].value = Math.max(resource.value - 1, 0);
		await this._onSave(this._list);
	}

	update(data) {
		switch (data.name) {
			case 'ress-next-name':
				return this._updateNextName(data.value);
			case 'ress-next-color':
				return this._updateNextColor(data.value);
			case 'ress-next-max':
				return this._updateNextMax(data.value);
			case 'ress-next-value':
				return this._updateNextValue(data.value);
			case 'ress-next-order':
				return this._updateNextOrder(data.value);
			default:
				return false;
		}
	}

	_focusInput() {
		// Grab the focus of the name input to create new elements
		const overlay = document.getElementById(`panel-resources-${this._id}`);
		overlay.querySelector('.ress-next-name').focus();
	}

	_updateNextName(value) {
		// ToDo Validate value and adjust
		this._state.next.name = value;
		return true;
	}

	_updateNextColor(value) {
		// ToDo Validate value and adjust
		this._state.next.color = value;
		return true;
	}

	_updateNextMax(value) {
		// ToDo Validate value and adjust
		this._state.next.max = parseInt(value);
		return true;
	}

	_updateNextValue(value) {
		// ToDo Validate value and adjust
		this._state.next.value = parseInt(value);
		return true;
	}

	_updateNextOrder(value) {
		// ToDo Validate value and adjust
		this._state.next.order = parseInt(value);
		return true;
	}
}
