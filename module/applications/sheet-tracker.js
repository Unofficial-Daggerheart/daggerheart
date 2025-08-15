/**
 * Sheet Tracker System
 * A customizable tracker management system for character sheets
 * Allows players to create, manage, and track various resources with custom colors
 */
/**
 * Resource Tracker System for FoundryVTT Actor Sheets
 * Provides a clean, efficient sidebar interface for managing custom resource trackers
 */
export class SheetTracker {
	// Static registry to track all active instances
	static instances = new Map();

	/**
	 * Static API Methods - These can be called from macros or other code
	 */

	/**
	 * Add a new tracker to an actor or item
	 * @param {string|Actor|Item} actorRef - Actor/Item ID or Actor/Item object (names deprecated)
	 * @param {string} trackerName - Name for the tracker
	 * @param {string} hexColor - Hex color code (e.g., "#ff0000")
	 * @param {number} initialValue - Starting value (default: 0)
	 * @param {number} max - Maximum value (optional)
	 * @returns {Promise<Object>} The created tracker data
	 */
	static async addTracker(actorRef, trackerName, hexColor = '#f3c267', initialValue = 0, max = null) {
		const actor = this._resolveActor(actorRef);
		if (!actor) throw new Error(`Document not found: ${actorRef}`);

		const tracker = {
			id: foundry.utils.randomID(),
			name: trackerName || 'Resource',
			value: Math.max(0, parseInt(initialValue) || 0),
			max: max ? Math.max(1, parseInt(max)) : null,
			color: hexColor || '#f3c267',
			order: actor.system.resourceTrackers?.length || 0,
		};

		const trackers = [...(actor.system.resourceTrackers || [])];
		trackers.push(tracker);

		await actor.update({ 'system.resourceTrackers': trackers });
		SheetTracker._updateInstances(actor.id);
		return tracker;
	}

	/**
	 * Update a tracker's value
	 * @param {string|Actor|Item} actorRef - Actor/Item ID or Actor/Item object
	 * @param {string} trackerNameOrId - Tracker name or ID
	 * @param {number} newValue - New value to set
	 * @returns {Promise<Object>} The updated tracker data
	 */
	static async updateTrackerValue(actorRef, trackerNameOrId, newValue) {
		const actor = this._resolveActor(actorRef);
		if (!actor) throw new Error(`Actor not found: ${actorRef}`);

		const trackers = [...(actor.system.resourceTrackers || [])];
		const tracker = trackers.find(t => t.id === trackerNameOrId || t.name === trackerNameOrId);

		if (!tracker) throw new Error(`Tracker not found: ${trackerNameOrId}`);

		tracker.value = Math.max(0, parseInt(newValue) || 0);
		if (tracker.max !== null) {
			tracker.value = Math.min(tracker.value, tracker.max);
		}

		await actor.update({ 'system.resourceTrackers': trackers });
		SheetTracker._updateInstances(actor.id);
		return tracker;
	}

	/**
	 * Modify a tracker's value by a delta
	 * @param {string|Actor|Item} actorRef - Actor/Item ID or Actor/Item object
	 * @param {string} trackerNameOrId - Tracker name or ID
	 * @param {number} delta - Amount to change by (can be negative)
	 * @returns {Promise<Object>} The updated tracker data
	 */
	static async modifyTrackerValue(actorRef, trackerNameOrId, delta) {
		const actor = this._resolveActor(actorRef);
		if (!actor) throw new Error(`Actor not found: ${actorRef}`);

		const trackers = [...(actor.system.resourceTrackers || [])];
		const tracker = trackers.find(t => t.id === trackerNameOrId || t.name === trackerNameOrId);

		if (!tracker) throw new Error(`Tracker not found: ${trackerNameOrId}`);

		tracker.value = Math.max(0, tracker.value + (parseInt(delta) || 0));
		if (tracker.max !== null) {
			tracker.value = Math.min(tracker.value, tracker.max);
		}

		await actor.update({ 'system.resourceTrackers': trackers });
		SheetTracker._updateInstances(actor.id);
		return tracker;
	}

	/**
	 * Remove a tracker from an actor or item
	 * @param {string|Actor|Item} actorRef - Actor/Item ID or Actor/Item object
	 * @param {string} trackerNameOrId - Tracker name or ID
	 * @returns {Promise<boolean>} Success status
	 */
	static async removeTracker(actorRef, trackerNameOrId) {
		const actor = this._resolveActor(actorRef);
		if (!actor) throw new Error(`Actor not found: ${actorRef}`);

		const trackers = [...(actor.system.resourceTrackers || [])];
		const index = trackers.findIndex(t => t.id === trackerNameOrId || t.name === trackerNameOrId);

		if (index === -1) throw new Error(`Tracker not found: ${trackerNameOrId}`);

		trackers.splice(index, 1);
		trackers.forEach((t, i) => (t.order = i));

		await actor.update({ 'system.resourceTrackers': trackers });
		SheetTracker._updateInstances(actor.id);
		return true;
	}

	/**
	 * Get all trackers for an actor or item
	 * @param {string|Actor|Item} actorRef - Actor/Item ID or Actor/Item object
	 * @returns {Array} Array of tracker objects
	 */
	static getTrackers(actorRef) {
		const actor = this._resolveActor(actorRef);
		if (!actor) throw new Error(`Actor not found: ${actorRef}`);
		return [...(actor.system.resourceTrackers || [])];
	}

	/**
	 * Get a specific tracker
	 * @param {string|Actor|Item} actorRef - Actor/Item ID or Actor/Item object
	 * @param {string} trackerNameOrId - Tracker name or ID
	 * @returns {Object|null} The tracker object or null if not found
	 */
	static getTracker(actorRef, trackerNameOrId) {
		const actor = this._resolveActor(actorRef);
		if (!actor) return null;

		const trackers = actor.system.resourceTrackers || [];
		return trackers.find(t => t.id === trackerNameOrId || t.name === trackerNameOrId) || null;
	}

	/**
	 * Clear all trackers for an actor or item
	 * @param {string|Actor|Item} actorRef - Actor/Item ID or Actor/Item object
	 * @returns {Promise<void>}
	 */
	static async clearAllTrackers(actorRef) {
		const actor = this._resolveActor(actorRef);
		if (!actor) throw new Error(`Actor not found: ${actorRef}`);
		await actor.update({ 'system.resourceTrackers': [] });
		SheetTracker._updateInstances(actor.id);
	}

	/**
	 * Batch update multiple trackers
	 * @param {string|Actor|Item} actorRef - Actor/Item ID or Actor/Item object
	 * @param {Array<Object>} updates - Array of {nameOrId, value} objects
	 * @returns {Promise<Array>} Updated trackers
	 */
	static async batchUpdateTrackers(actorRef, updates) {
		const actor = this._resolveActor(actorRef);
		if (!actor) throw new Error(`Actor not found: ${actorRef}`);

		const trackers = [...(actor.system.resourceTrackers || [])];
		const updatedTrackers = [];

		for (const update of updates) {
			const tracker = trackers.find(t => t.id === update.nameOrId || t.name === update.nameOrId);
			if (tracker) {
				tracker.value = Math.max(0, parseInt(update.value) || 0);
				if (tracker.max !== null) {
					tracker.value = Math.min(tracker.value, tracker.max);
				}
				updatedTrackers.push(tracker);
			}
		}

		await actor.update({ 'system.resourceTrackers': trackers });
		SheetTracker._updateInstances(actor.id);
		return updatedTrackers;
	}

	/**
	 * Resolve an actor or item from various input types
	 * @private
	 */
	static _resolveActor(actorRef) {
		if (actorRef instanceof Actor || actorRef instanceof Item) return actorRef;

		// Try actors first
		let document = game.actors.get(actorRef);

		// If not found, try global items
		if (!document) {
			document = game.items.get(actorRef);
		}

		// If still not found, search embedded items in all actors
		if (!document && typeof actorRef === 'string') {
			for (const actor of game.actors) {
				const embeddedItem = actor.items.get(actorRef);
				if (embeddedItem) {
					document = embeddedItem;
					break;
				}
			}
		}

		// Fallback to name lookup with warning (actors only for now)
		if (!document && typeof actorRef === 'string') {
			const nameActor = game.actors.find(a => a.name === actorRef);
			if (nameActor) {
				console.warn(
					`SheetTracker: Actor name lookup is deprecated. Use ID "${nameActor.id}" instead of name "${actorRef}".`
				);
				return nameActor;
			}
		}

		return document;
	}

	/**
	 * Update all instances for a specific actor (called by static API methods)
	 * @private
	 */
	static _updateInstances(actorId) {
		const instance = SheetTracker.instances.get(actorId);
		if (instance && instance.isInitialized) {
			instance._loadTrackers();
			instance._renderTrackerButtons();
			instance._renderTrackerList();
		}
	}

	/**
	 * Instance Methods
	 */
	constructor(actorSheet) {
		this.actorSheet = actorSheet;

		// For item sheets, always use the item (object), not the owning actor
		if (actorSheet.constructor.name.includes('ItemSheet') || actorSheet.object?.documentName === 'Item') {
			this.actor = actorSheet.object; // Always use the item itself
		} else {
			this.actor = actorSheet.actor; // Use the actor for actor sheets
		}

		this.actorId = this.actor.id;

		// UI Elements
		this.sidebarElement = null;
		this.managerElement = null;
		this.buttonsContainer = null;
		this.listContainer = null;

		// State
		this.isExpanded = false;
		this.trackers = new Map(); // Use Map for O(1) lookups
		this.isInitialized = false;

		// Debouncing and batching
		this.updateQueue = new Set();
		this.updateTimeout = null;

		// Hook management
		this.hooks = new Map();

		// Register this instance
		SheetTracker.instances.set(this.actorId, this);
	}

	/**
	 * Initialize the sheet tracker system
	 */
	async initialize() {
		if (this.isInitialized) return;

		try {
			this._loadTrackers();
			await this._render();
			this._setupEventListeners();
			this._setupHooks();

			this.isInitialized = true;

			// Set initial nav state for character, NPC, and environment sheets
			if (this._isCharacterSheet()) {
				const currentTab = this.actorSheet.element.find('.sheet-tabs .item.active').data('tab') || 'character';
				this._updateNavActiveState(currentTab);
			} else if (this._isNPCSheet()) {
				if (this._isSimpleAdversaryEnabled()) {
					// For simple adversary sheets, force the simple tab to be active
					this._activateSimpleTab();
				} else {
					const currentTab = this.actorSheet.element.find('.sheet-tabs .item.active').data('tab') || 'adversary';
					this._updateNavActiveState(currentTab);
				}
			} else if (this._isEnvironmentSheet()) {
				const currentTab = this.actorSheet.element.find('.sheet-tabs .item.active').data('tab') || 'actions';
				this._updateNavActiveState(currentTab);
			}
		} catch (error) {
			console.error('SheetTracker: Failed to initialize', error);
		}
	}

	/**
	 * Load trackers from actor/item data into local Map
	 */
	_loadTrackers() {
		const trackerData = this.actor.system.resourceTrackers || [];
		this.trackers.clear();

		trackerData.forEach(t => {
			this.trackers.set(t.id, {
				id: t.id,
				name: t.name || 'Resource',
				value: Math.max(0, parseInt(t.value) || 0),
				max: t.max ? Math.max(1, parseInt(t.max)) : null,
				color: t.color || '#f3c267',
				order: t.order || 0,
			});
		});
	}

	/**
	 * Check if this is a character sheet (for navigation buttons)
	 */
	_isCharacterSheet() {
		return this.actor.type === 'character' && this.actorSheet.constructor.name === 'SimpleActorSheet';
	}

	/**
	 * Check if this is an NPC sheet (for navigation buttons)
	 */
	_isNPCSheet() {
		return this.actor.type === 'npc' && this.actorSheet.constructor.name === 'NPCActorSheet';
	}

	/**
	 * Check if simple adversary sheets are enabled
	 */
	_isSimpleAdversaryEnabled() {
		return game.settings.get('daggerheart-unofficial', 'simpleAdversarySheets');
	}

	/**
	 * Check if this is an environment sheet (for navigation buttons)
	 */
	_isEnvironmentSheet() {
		return this.actor.type === 'environment' && this.actorSheet.constructor.name === 'EnvironmentActorSheet';
	}

	/**
	 * Check if this is an item sheet
	 */
	_isItemSheet() {
		return this.actor.documentName === 'Item' || this.actorSheet.constructor.name.includes('ItemSheet');
	}

	/**
	 * Render the tracker sidebar
	 */
	async _render() {
		const sheet = this.actorSheet.element;
		if (!sheet?.length) {
			throw new Error('SheetTracker: No sheet element found');
		}

		// Clean up existing sidebar
		this._cleanupDOM();

		const isCharacterSheet = this._isCharacterSheet();
		const isNPCSheet = this._isNPCSheet();
		const isEnvironmentSheet = this._isEnvironmentSheet();
		const isSimpleAdversary = isNPCSheet && this._isSimpleAdversaryEnabled();
		const sidebarHtml = this._buildSidebarHTML(isCharacterSheet, isNPCSheet, isEnvironmentSheet, isSimpleAdversary);

		// Insert sidebar
		const windowContent = sheet.find('.window-content');
		if (!windowContent.length) {
			throw new Error('SheetTracker: No .window-content element found');
		}

		windowContent.first().append(sidebarHtml);

		// Cache DOM references
		this.sidebarElement = sheet.find('.sheet-tracker-sidebar');
		this.managerElement = this.sidebarElement.find('.tracker-manager-panel');
		this.buttonsContainer = this.sidebarElement.find('.tracker-buttons-container');
		this.listContainer = this.sidebarElement.find('.tracker-list-items');

		// Render content
		this._renderTrackerButtons();
		this._renderTrackerList();
	}

	/**
	 * Build the sidebar HTML structure
	 */
	_buildSidebarHTML(isCharacterSheet, isNPCSheet, isEnvironmentSheet, isSimpleAdversary) {
		let navButtons = '';

		if (isCharacterSheet) {
			navButtons = `
        <div class="sidebar-nav-buttons">
          <div class="nav-button" data-tab="character" title="Character"><i class="fas fa-user"></i></div>
          <div class="nav-button" data-tab="equipment" title="Equipment"><i class="fas fa-hammer"></i></div>
          <div class="nav-button" data-tab="loadout" title="Loadout"><i class="fas fa-suitcase"></i></div>
          <div class="nav-button" data-tab="biography" title="Biography"><i class="fas fa-book-open"></i></div>
          <div class="nav-button" data-tab="advancement" title="Advancement"><i class="fas fa-medal"></i></div>
        </div>`;
		} else if (isNPCSheet && !isSimpleAdversary) {
			navButtons = `
        <div class="sidebar-nav-buttons">
          <div class="nav-button" data-tab="adversary" title="Adversary"><i class="fas fa-sword"></i></div>
          <div class="nav-button" data-tab="description" title="Description"><i class="fas fa-file-text"></i></div>
        </div>`;
		} else if (isEnvironmentSheet) {
			navButtons = `
        <div class="sidebar-nav-buttons">
          <div class="nav-button" data-tab="actions" title="Actions"><i class="fas fa-bolt"></i></div>
          <div class="nav-button" data-tab="adversaries" title="Potential Adversaries"><i class="fas fa-users"></i></div>
          <div class="nav-button" data-tab="notes" title="Notes"><i class="fas fa-sticky-note"></i></div>
        </div>`;
		}
		// Note: For simple adversary sheets (isSimpleAdversary = true), navButtons remains empty

		return `
      <div class="sheet-tracker-sidebar" data-actor-id="${this.actorId}">
        ${navButtons}
        <div class="tracker-main-button" title="Resource Tracker">
          <i class="fas fa-stopwatch"></i>
        </div>
        <div class="tracker-buttons-container"></div>
        <div class="tracker-manager-panel">
          <div class="tracker-manager-header">
            <span>Resource Tracker</span>
            <button class="tracker-manager-close" title="Close">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="tracker-manager-content">
            <div class="tracker-add-form">
              <div class="form-group">
                <label>Name</label>
                <input type="text" class="tracker-name-input" placeholder="Resource name" value="Resource">
              </div>
              <div class="form-group-horizontal">
                <div class="form-group-half">
                  <label>Value</label>
                  <div class="value-inputs">
                    <input type="number" class="tracker-value-input" placeholder="0" value="0" min="0">
                    <span class="value-separator">/</span>
                    <input type="number" class="tracker-max-input" placeholder="Max" min="0">
                  </div>
                </div>
                <div class="form-group-half">
                  <label>Color</label>
                  <div class="color-input-wrapper">
                    <input type="color" class="tracker-color-input" value="#f3c267">
                    <span class="color-preview" style="background-color: #f3c267;"></span>
                  </div>
                </div>
              </div>
              <button class="tracker-add-button">
                <i class="fas fa-plus"></i> Add Resource
              </button>
            </div>
            <div class="tracker-list">
              <div class="tracker-list-header">Existing Resources</div>
              <div class="tracker-list-items"></div>
            </div>
          </div>
        </div>
      </div>
    `;
	}

	/**
	 * Render tracker buttons efficiently
	 */
	_renderTrackerButtons() {
		if (!this.buttonsContainer) return;

		const fragment = document.createDocumentFragment();
		const sortedTrackers = Array.from(this.trackers.values()).sort((a, b) => a.order - b.order);

		sortedTrackers.forEach(tracker => {
			const button = document.createElement('div');
			button.className = 'tracker-button';
			button.dataset.trackerId = tracker.id;
			button.dataset.trackerName = tracker.name; // This is needed for CSS hover tooltip
			button.dataset.trackerColor = tracker.color;
			button.title = `${tracker.name}: ${tracker.value}${tracker.max ? '/' + tracker.max : ''}`;
			button.style.backgroundColor = tracker.color;

			const valueSpan = document.createElement('span');
			valueSpan.className = 'tracker-button-value';
			valueSpan.textContent = tracker.value;
			button.appendChild(valueSpan);

			fragment.appendChild(button);
		});

		this.buttonsContainer.empty().append(fragment);
	}

	/**
	 * Render tracker list efficiently
	 */
	_renderTrackerList() {
		if (!this.listContainer) return;

		if (this.trackers.size === 0) {
			this.listContainer.html('<div class="no-trackers">No resources yet</div>');
			return;
		}

		const fragment = document.createDocumentFragment();
		const sortedTrackers = Array.from(this.trackers.values()).sort((a, b) => a.order - b.order);

		sortedTrackers.forEach(tracker => {
			const item = document.createElement('div');
			item.className = 'tracker-list-item';
			item.dataset.trackerId = tracker.id;

			item.innerHTML = `
        <span class="tracker-item-color" style="background-color: ${tracker.color};"></span>
        <span class="tracker-item-name">${tracker.name}</span>
        <span class="tracker-item-value">${tracker.value}${tracker.max ? '/' + tracker.max : ''}</span>
        <button class="tracker-item-delete" title="Delete resource">
          <i class="fas fa-times"></i>
        </button>
      `;

			fragment.appendChild(item);
		});

		this.listContainer.empty().append(fragment);
	}

	/**
	 * Update a single tracker button (efficient partial update)
	 */
	_updateTrackerButton(trackerId) {
		const tracker = this.trackers.get(trackerId);
		if (!tracker) return;

		const button = this.buttonsContainer?.find(`[data-tracker-id="${trackerId}"]`);
		if (button?.length) {
			button.find('.tracker-button-value').text(tracker.value);
			button.attr('title', `${tracker.name}: ${tracker.value}${tracker.max ? '/' + tracker.max : ''}`);
			button.attr('data-tracker-name', tracker.name); // Update for CSS hover tooltip
		}
	}

	/**
	 * Update a single tracker list item (efficient partial update)
	 */
	_updateTrackerListItem(trackerId) {
		const tracker = this.trackers.get(trackerId);
		if (!tracker) return;

		const listItem = this.listContainer?.find(`[data-tracker-id="${trackerId}"]`);
		if (listItem?.length) {
			listItem.find('.tracker-item-value').text(`${tracker.value}${tracker.max ? '/' + tracker.max : ''}`);
		}
	}

	/**
	 * Set up event listeners with proper delegation and error handling
	 */
	_setupEventListeners() {
		if (!this.sidebarElement) return;

		// Main button click - toggle manager
		this.sidebarElement.find('.tracker-main-button').on('click.sheetTracker', e => {
			e.preventDefault();
			e.stopPropagation();
			this.toggleManager();
		});

		// Close button
		this.sidebarElement.find('.tracker-manager-close').on('click.sheetTracker', e => {
			e.preventDefault();
			e.stopPropagation();
			this.toggleManager(false);
		});

		// Add tracker button
		this.sidebarElement.find('.tracker-add-button').on('click.sheetTracker', e => {
			e.preventDefault();
			e.stopPropagation();
			this._handleAddTracker();
		});

		// Tracker button interactions (use delegation for dynamic content)
		this.sidebarElement.on('click.sheetTracker', '.tracker-button', e => {
			e.preventDefault();
			e.stopPropagation();
			const trackerId = $(e.currentTarget).data('tracker-id');
			this._queueTrackerUpdate(trackerId, 1);
		});

		this.sidebarElement.on('contextmenu.sheetTracker', '.tracker-button', e => {
			e.preventDefault();
			e.stopPropagation();
			const trackerId = $(e.currentTarget).data('tracker-id');
			this._queueTrackerUpdate(trackerId, -1);
		});

		// Delete tracker button (use delegation for dynamic content)
		this.sidebarElement.on('click.sheetTracker', '.tracker-item-delete', e => {
			e.preventDefault();
			e.stopPropagation();
			const trackerId = $(e.currentTarget).closest('.tracker-list-item').data('tracker-id');
			this._handleDeleteTracker(trackerId);
		});

		// Color input preview
		this.sidebarElement.find('.tracker-color-input').on('input.sheetTracker', e => {
			const color = $(e.target).val();
			this.sidebarElement.find('.color-preview').css('background-color', color);
		});

		// Navigation buttons for character, NPC, and environment sheets
		if (this._isCharacterSheet() || this._isNPCSheet() || this._isEnvironmentSheet()) {
			this._setupNavigationListeners();
		}
	}

	/**
	 * Set up navigation listeners for character and NPC sheets
	 */
	_setupNavigationListeners() {
		// Navigation button clicks
		this.sidebarElement.on('click.sheetTracker', '.nav-button', e => {
			e.preventDefault();
			e.stopPropagation();
			const tab = $(e.currentTarget).data('tab');
			this._handleNavigation(tab);
		});

		// Keep sidebar navigation in sync with tab changes (only if not simple adversary)
		if (!(this._isNPCSheet() && this._isSimpleAdversaryEnabled())) {
			this.actorSheet.element.on('click.sheetTracker', '.sheet-tabs .item', e => {
				const tab = $(e.currentTarget).data('tab');
				if (tab) {
					this._updateNavActiveState(tab);
				}
			});
		}
	}

	/**
	 * Activate the simple tab for simple adversary sheets
	 */
	_activateSimpleTab() {
		// Hide all other tabs and show only the simple tab
		const sheetElement = this.actorSheet.element;

		// Hide all tab navigation items except simple
		sheetElement.find('.sheet-tabs .item').hide();
		sheetElement.find('.sheet-tabs .item[data-tab="simple"]').show().addClass('active');

		// Hide all tab content except simple
		sheetElement.find('.sheet-body .tab').removeClass('active');
		sheetElement.find('.sheet-body .tab[data-tab="simple"]').addClass('active');
	}

	/**
	 * Handle navigation button clicks
	 */
	_handleNavigation(tab) {
		if (!tab) return;

		const anchor = this.actorSheet.element.find(`.sheet-tabs .item[data-tab="${tab}"]`);
		if (anchor.length) {
			anchor[0].click();
		}
		this._updateNavActiveState(tab);
	}

	/**
	 * Toggle the manager panel
	 */
	toggleManager(show = null) {
		this.isExpanded = show !== null ? show : !this.isExpanded;

		if (this.isExpanded) {
			this.sidebarElement.addClass('expanded');
			this.managerElement.addClass('show');
		} else {
			this.sidebarElement.removeClass('expanded');
			this.managerElement.removeClass('show');
		}
	}

	/**
	 * Handle adding a new tracker with validation
	 */
	async _handleAddTracker() {
		try {
			const name = this.sidebarElement.find('.tracker-name-input').val().trim() || 'Resource';
			const value = Math.max(0, parseInt(this.sidebarElement.find('.tracker-value-input').val()) || 0);
			const max = parseInt(this.sidebarElement.find('.tracker-max-input').val()) || null;
			const color = this.sidebarElement.find('.tracker-color-input').val() || '#f3c267';

			const tracker = {
				id: foundry.utils.randomID(),
				name,
				value,
				max: max && max > 0 ? Math.max(1, max) : null,
				color,
				order: this.trackers.size,
			};

			await this._addTracker(tracker);
			this._resetForm();
		} catch (error) {
			console.error('SheetTracker: Error adding tracker', error);
			ui.notifications.error('Failed to add resource tracker');
		}
	}

	/**
	 * Handle deleting a tracker with confirmation
	 */
	async _handleDeleteTracker(trackerId) {
		const tracker = this.trackers.get(trackerId);
		if (!tracker) return;

		const confirmed = await Dialog.confirm({
			title: 'Delete Resource Tracker',
			content: `<p>Are you sure you want to delete the "${tracker.name}" tracker?</p>`,
			yes: () => true,
			no: () => false,
		});

		if (confirmed) {
			await this._deleteTracker(trackerId);
		}
	}

	/**
	 * Add a tracker with proper error handling
	 */
	async _addTracker(trackerData) {
		try {
			this.trackers.set(trackerData.id, trackerData);
			await this._saveTrackers();

			// Update UI efficiently
			this._renderTrackerButtons();
			this._renderTrackerList();
		} catch (error) {
			this.trackers.delete(trackerData.id);
			throw error;
		}
	}

	/**
	 * Delete a tracker with proper cleanup
	 */
	async _deleteTracker(trackerId) {
		const tracker = this.trackers.get(trackerId);
		if (!tracker) return;

		try {
			this.trackers.delete(trackerId);

			// Reorder remaining trackers
			let order = 0;
			for (const t of this.trackers.values()) {
				t.order = order++;
			}

			await this._saveTrackers();

			// Update UI
			this._renderTrackerButtons();
			this._renderTrackerList();
		} catch (error) {
			// Restore tracker on error
			this.trackers.set(trackerId, tracker);
			throw error;
		}
	}

	/**
	 * Queue tracker value updates to prevent spam
	 */
	_queueTrackerUpdate(trackerId, delta) {
		// Find existing update for this tracker or create new one
		let existingUpdate = null;
		for (const update of this.updateQueue) {
			if (update.trackerId === trackerId) {
				existingUpdate = update;
				break;
			}
		}

		if (existingUpdate) {
			existingUpdate.delta += delta;
		} else {
			this.updateQueue.add({ trackerId, delta });
		}

		// Clear existing timeout
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
		}

		// Process updates after a short delay
		this.updateTimeout = setTimeout(() => {
			this._processUpdateQueue();
		}, 50); // 50ms debounce
	}

	/**
	 * Process queued updates efficiently
	 */
	async _processUpdateQueue() {
		if (this.updateQueue.size === 0) return;

		const updates = Array.from(this.updateQueue);
		this.updateQueue.clear();

		try {
			// Batch process updates
			const changes = new Map();

			for (const { trackerId, delta } of updates) {
				const tracker = this.trackers.get(trackerId);
				if (!tracker) continue;

				const currentDelta = changes.get(trackerId) || 0;
				const newDelta = currentDelta + delta;
				changes.set(trackerId, newDelta);
			}

			// Apply changes
			let hasChanges = false;
			for (const [trackerId, delta] of changes) {
				const tracker = this.trackers.get(trackerId);
				if (!tracker) continue;

				const oldValue = tracker.value;
				tracker.value = Math.max(0, tracker.value + delta);

				if (tracker.max !== null) {
					tracker.value = Math.min(tracker.value, tracker.max);
				}

				if (tracker.value !== oldValue) {
					hasChanges = true;
					// Update UI immediately for responsiveness
					this._updateTrackerButton(trackerId);
					this._updateTrackerListItem(trackerId);
				}
			}

			// Save to actor if there were changes
			if (hasChanges) {
				await this._saveTrackers();
			}
		} catch (error) {
			console.error('SheetTracker: Error processing updates', error);
		}
	}

	/**
	 * Reset the add tracker form
	 */
	_resetForm() {
		if (!this.sidebarElement) return;
		this.sidebarElement.find('.tracker-name-input').val('Resource');
		this.sidebarElement.find('.tracker-value-input').val('0');
		this.sidebarElement.find('.tracker-max-input').val('');
		this.sidebarElement.find('.tracker-color-input').val('#f3c267');
		this.sidebarElement.find('.color-preview').css('background-color', '#f3c267');
	}

	/**
	 * Update navigation active state
	 */
	_updateNavActiveState(activeTab) {
		if (!this.sidebarElement || (!this._isCharacterSheet() && !this._isNPCSheet() && !this._isEnvironmentSheet()))
			return;

		// Don't update nav state for simple adversary sheets since they have no nav buttons
		if (this._isNPCSheet() && this._isSimpleAdversaryEnabled()) return;

		const navButtons = this.sidebarElement.find('.nav-button');
		navButtons.removeClass('active');
		this.sidebarElement.find(`.nav-button[data-tab="${activeTab}"]`).addClass('active');
	}

	/**
	 * Save trackers to actor/item data efficiently
	 */
	async _saveTrackers() {
		const trackerArray = Array.from(this.trackers.values());
		await this.actor.update({ 'system.resourceTrackers': trackerArray });
	}

	/**
	 * Set up hooks for actor/item updates
	 */
	_setupHooks() {
		if (this._isItemSheet()) {
			// For items, we need to listen to both updateItem (for global items)
			// and updateActor (for embedded items)

			// Listen for direct item updates (global items)
			const itemUpdateHook = Hooks.on('updateItem', (item, changes) => {
				if (item.id !== this.actorId) return;
				if (!changes.system?.resourceTrackers) return;

				this._loadTrackers();
				this._renderTrackerButtons();
				this._renderTrackerList();
			});

			// Listen for actor updates that might affect embedded items
			const actorUpdateHook = Hooks.on('updateActor', (actor, changes) => {
				// Check if this update affects our embedded item
				if (this.actor.parent && actor.id === this.actor.parent.id) {
					// Check if our specific item was updated
					const itemUpdates = changes.items;
					if (itemUpdates) {
						const ourItemUpdate = itemUpdates.find(update => update._id === this.actorId);
						if (ourItemUpdate && ourItemUpdate.system?.resourceTrackers) {
							this._loadTrackers();
							this._renderTrackerButtons();
							this._renderTrackerList();
						}
					}
				}
			});

			this.hooks.set('updateItem', itemUpdateHook);
			this.hooks.set('updateActor', actorUpdateHook);
		} else {
			// For actors, just listen to updateActor
			const updateHook = Hooks.on('updateActor', (actor, changes) => {
				if (actor.id !== this.actorId) return;
				if (!changes.system?.resourceTrackers) return;

				this._loadTrackers();
				this._renderTrackerButtons();
				this._renderTrackerList();
			});

			this.hooks.set('updateActor', updateHook);
		}
	}

	/**
	 * Clean up DOM elements
	 */
	_cleanupDOM() {
		this.actorSheet.element.find('.sheet-tracker-sidebar').remove();
		this.sidebarElement = null;
		this.managerElement = null;
		this.buttonsContainer = null;
		this.listContainer = null;
	}

	/**
	 * Clean up all hooks
	 */
	_cleanupHooks() {
		for (const [event, hookId] of this.hooks) {
			Hooks.off(event, hookId);
		}
		this.hooks.clear();
	}

	/**
	 * Clean up event listeners
	 */
	_cleanupEventListeners() {
		if (this.sidebarElement) {
			this.sidebarElement.off('.sheetTracker');
		}
		if (this.actorSheet.element) {
			this.actorSheet.element.off('.sheetTracker');
		}
	}

	/**
	 * Clean up update queue
	 */
	_cleanupUpdateQueue() {
		if (this.updateTimeout) {
			clearTimeout(this.updateTimeout);
			this.updateTimeout = null;
		}
		this.updateQueue.clear();
	}

	/**
	 * Destroy the sheet tracker instance with complete cleanup
	 */
	destroy() {
		this._cleanupEventListeners();
		this._cleanupHooks();
		this._cleanupUpdateQueue();
		this._cleanupDOM();

		// Remove from static registry
		SheetTracker.instances.delete(this.actorId);

		this.isInitialized = false;
	}
}
