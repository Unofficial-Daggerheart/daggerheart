import { buildItemCardChat } from '../helpers/helper.js';
import { DaggerheartDialogHelper } from '../helpers/dialog-helper.js';

export class DomainAbilitySidebar {
	constructor(actorSheet) {
		this.actorSheet = actorSheet;
		this.actor = actorSheet.actor;
		this.sidebarElement = null;
		this.previewTimeout = null;
		this.previewElement = null;
		this.previewPinned = false;
		this.pinnedItemId = null;
		this.slotTypes = [
			{ key: 'domain', label: 'ITEM.TypeDomain' },
			{ key: 'class', label: 'ITEM.TypeClass' },
			{ key: 'subclass', label: 'ITEM.TypeSubclass' },
			{ key: 'community', label: 'ITEM.TypeCommunity' },
			{ key: 'ancestry', label: 'ITEM.TypeAncestry' },
		];
	}

	/** Re-creates the sidebar every time the sheet renders */
	initialize() {
		this.render();
	}

	/** Build and insert the sidebar DOM */
	render() {
		const sheet = this.actorSheet.element;
		if (!sheet || !sheet.length) return;

		sheet.find('.domain-abilities-sidebar').remove();

		const windowContent = sheet.find('.window-content');
		if (windowContent.length === 0) return;

		const sectionsHtml = this._renderAllSections();
		if (!sectionsHtml) return;

		const sidebarHtml = `<div class="domain-abilities-sidebar">${sectionsHtml}</div>`;

		windowContent.first().append(sidebarHtml);

		this.sidebarElement = sheet.find('.domain-abilities-sidebar');
		this._activateListeners();
	}

	/** Render all slot sections */
	_renderAllSections() {
		const sections = [];

		this.slotTypes.forEach(slotType => {
			const items = this._getItemsForSlotType(slotType);
			const sectionHtml = this._renderSection(slotType, items);
			sections.push(sectionHtml);
		});

		return sections.join('');
	}

	/** Get items for a specific slot type */
	_getItemsForSlotType(slotType) {
		return this.actor.items.filter(item => {
			const loc = item.system?.location;
			// Exclude items in the vault
			if (loc === 'vault') return false;

			if (slotType.key === 'domain') {
				// Mirror the domain logic: location is abilities/domain/undefined/null, but not vault
				return loc === 'abilities' || loc === 'domain' || loc === undefined || loc === null;
			}
			// For all other sections, only show items with location matching the slot key
			return loc === slotType.key;
		});
	}

	/** Render a single section */
	_renderSection(slotType, items) {
		const titleHtml = `<div class="domain-abilities-title">${game.i18n.localize(slotType.label)}</div>`;
		const buttonsHtml = this._renderSectionButtons(slotType, items);
		return titleHtml + buttonsHtml;
	}

	/** Render buttons for a section */
	_renderSectionButtons(slotType, items) {
		items.sort((a, b) => a.name.localeCompare(b.name));

		let html = items
			.map(
				item => `
        <div class="domain-ability-button" data-item-id="${item.id}" data-slot-type="${slotType.key}" title="${item.name}">
          ${this._renderTrackerBubbles(item)}
          <img class="ability-img" src="${item.img}" />
          <div class="ability-overlay">
            <a class="item-control" data-action="edit" title="Edit"><i class="fas fa-edit"></i></a>
            <a class="item-control" data-action="delete" title="Delete"><i class="fas fa-trash"></i></a>
            ${slotType.key === 'domain' ? `<a class="item-control" data-action="send-to-vault" title="Send to Vault"><i class="fas fa-arrow-right"></i></a>` : ''}
          </div>
          <span class="ability-name">${item.name}</span>
        </div>`
			)
			.join('');

		return html;
	}

	/** Pull Domain Ability items from the actor (legacy method) */
	_getDomainAbilityItems() {
		return this._getItemsForSlotType({ key: 'domain' });
	}

	/** Render tracker notification bubbles for an item */
	_renderTrackerBubbles(item) {
		const trackers = item.system?.resourceTrackers || [];
		if (trackers.length === 0) return '';

		const bubbles = trackers
			.map(
				tracker => `
      <div class="tracker-notification-bubble"
           data-item-id="${item.id}"
           data-tracker-id="${tracker.id}"
           style="background-color: ${tracker.color}"
           title="${tracker.name}: ${tracker.value}${tracker.max ? '/' + tracker.max : ''}">
        <span class="bubble-value">${tracker.value}</span>
      </div>
    `
			)
			.join('');

		return `<div class="tracker-notification-bubbles">${bubbles}</div>`;
	}

	/** Wire up click handlers */
	_activateListeners() {
		if (!this.sidebarElement) return;

		// Edit / delete buttons inside overlay
		this.sidebarElement.on('click', '.item-control', async ev => {
			ev.preventDefault();
			ev.stopPropagation();
			const action = ev.currentTarget.dataset.action || 'edit';
			const itemId = $(ev.currentTarget).closest('[data-item-id]').data('item-id');
			const item = this.actor.items.get(itemId);
			if (!item) return;

			switch (action) {
				case 'edit':
					if (item) return item.sheet.render(true);
					break;
				case 'delete':
					if (item) {
						const confirmResult = await DaggerheartDialogHelper.showDialog({
							title: 'Delete Ability',
							content: `<p>Are you sure you want to delete <strong>${item.name}</strong> from the sheet? This cannot be undone.</p>`,
							dialogClass: 'confirm-dialog',
							buttons: {
								confirm: {
									label: 'Delete',
									icon: '<i class="fas fa-trash"></i>',
									callback: () => true,
								},
								cancel: {
									label: 'Cancel',
									callback: () => null,
								},
							},
							default: 'cancel',
						});
						if (!confirmResult) break;
						await item.delete();
						this.render();
					}
					break;
				case 'send-to-vault':
					if (item) {
						const confirmResult = await DaggerheartDialogHelper.showDialog({
							title: 'Move to Vault',
							content: `<p>Are you sure you want to move <strong>${item.name}</strong> to the vault?</p>`,
							dialogClass: 'confirm-dialog',
							buttons: {
								confirm: {
									label: 'Move',
									icon: '<i class="fas fa-archive"></i>',
									callback: () => true,
								},
								cancel: {
									label: 'Cancel',
									callback: () => null,
								},
							},
							default: 'cancel',
						});
						if (!confirmResult) break;
						await item.update({ 'system.location': 'vault' });
						this.render();
					}
					break;
			}
		});

		// Click on the main button/image to post the item to chat
		this.sidebarElement.on('click', '.domain-ability-button', async ev => {
			// Ignore clicks that originated on overlay controls
			if ($(ev.target).closest('.ability-overlay').length) return;

			const itemId = $(ev.currentTarget).data('item-id');
			const item = this.actor.items.get(itemId);
			if (!item) return;

			// Post to chat – use Foundry's built-in method if available
			try {
				const itemData = item.system;
				// Don't pre-enrich for chat cards - let Foundry enrich it when the chat message is created

				const chatCard = buildItemCardChat({
					itemId: item.id,
					actorId: this.actor.id,
					image: item.img,
					name: item.name,
					category: itemData.category || '',
					rarity: itemData.rarity || '',
					description: itemData.description || '',
					extraClasses: 'domain-preview-card',
					itemType: item.type,
					system: item.system,
				});

				ChatMessage.create({
					user: game.user.id,
					speaker: ChatMessage.getSpeaker({ actor: this.actor }),
					content: chatCard,
				});
			} catch (err) {
				console.error('Failed to create ability chat card:', err);
			}
		});

		// Hover preview (350 ms delay)
		this.sidebarElement.on('mouseenter', '.domain-ability-button', ev => {
			// Don't show card preview if hovering over tracker bubbles
			if ($(ev.target).closest('.tracker-notification-bubble').length) return;

			const buttonEl = ev.currentTarget;
			const hoveredItemId = $(buttonEl).data('item-id');
			// If another preview is pinned and this is a different item, unpin it first
			if (this.previewPinned && hoveredItemId !== this.pinnedItemId) {
				this._unpinPreview();
			}
			// Prevent multiple timers
			clearTimeout(this.previewTimeout);
			this.previewTimeout = setTimeout(() => {
				this._showPreview(buttonEl);
			}, 350);
		});

		this.sidebarElement.on('mouseleave', '.domain-ability-button', () => {
			clearTimeout(this.previewTimeout);
			// Only hide if the preview has not been pinned by middle-click
			if (!this.previewPinned) this._hidePreview();
		});

		// Middle-click to pin/unpin the preview for interaction
		this.sidebarElement.on('mousedown', '.domain-ability-button', ev => {
			// 2 => middle button for jQuery "which"
			if (ev.which !== 2) return;
			ev.preventDefault();
			ev.stopPropagation();

			const buttonEl = ev.currentTarget;
			// Toggle pin state
			if (this.previewPinned) {
				this._unpinPreview();
			} else {
				// If preview not already visible for this item, show it immediately before pinning
				const itemId = $(buttonEl).data('item-id');
				if (!this.previewElement || !this.previewElement.hasClass('show') || this.pinnedItemId !== itemId) {
					clearTimeout(this.previewTimeout);
					this._showPreview(buttonEl);
				}
				this._pinPreview();
			}
		});

		// Tracker bubble interactions
		this.sidebarElement.on('click', '.tracker-notification-bubble', async ev => {
			ev.preventDefault();
			ev.stopPropagation();
			const itemId = $(ev.currentTarget).data('item-id');
			const trackerId = $(ev.currentTarget).data('tracker-id');
			await this._modifyTrackerValue(itemId, trackerId, 1);
		});

		this.sidebarElement.on('contextmenu', '.tracker-notification-bubble', async ev => {
			ev.preventDefault();
			ev.stopPropagation();
			const itemId = $(ev.currentTarget).data('item-id');
			const trackerId = $(ev.currentTarget).data('tracker-id');
			await this._modifyTrackerValue(itemId, trackerId, -1);
		});

		// Drag & Drop handlers for adding abilities
		this.sidebarElement.on('dragover', '.domain-ability-slot.empty', ev => {
			ev.preventDefault();
			$(ev.currentTarget).addClass('drag-over');
		});

		this.sidebarElement.on('dragleave', '.domain-ability-slot.empty', ev => {
			$(ev.currentTarget).removeClass('drag-over');
		});

		this.sidebarElement.on('drop', '.domain-ability-slot.empty', async ev => {
			ev.preventDefault();
			$(ev.currentTarget).removeClass('drag-over');
			await this._handleDrop(ev);
		});
	}

	/** Build and display preview card near the button */
	async _showPreview(buttonEl) {
		const itemId = $(buttonEl).data('item-id');
		const item = this.actor.items.get(itemId);
		if (!item) return;

		// Generate HTML card (same as chat)
		const itemData = item.system;
		// For preview cards, we DO want enrichment since they're not going through chat
		const description = await TextEditor.enrichHTML(itemData.description, { secrets: this.actor.isOwner, async: true });
		const cardHtml = buildItemCardChat({
			itemId: item.id,
			image: item.img,
			name: item.name,
			category: itemData.category || '',
			rarity: itemData.rarity || '',
			description,
			extraClasses: 'domain-preview-card',
			itemType: item.type,
			system: item.system,
		});

		const hintHtml = `<div class="preview-hint"><i class="fas fa-mouse"></i> Middle-click to pin</div>`;
		const fullHtml = cardHtml + hintHtml;

		// If preview element exists update, else create
		if (!this.previewElement) {
			this.previewElement = $('<div class="domain-ability-preview"></div>').appendTo('body');
		}
		this.previewElement.html(fullHtml);

		// Position: to the right of sidebar button (or at cursor)
		const rect = buttonEl.getBoundingClientRect();
		this._anchorRect = rect;
		const previewRect = this.previewElement[0].getBoundingClientRect();
		let left = rect.right + 12;
		let top = rect.top + rect.height / 2 - previewRect.height / 2;

		// keep on screen
		if (left + previewRect.width > window.innerWidth - 10) left = rect.left - previewRect.width - 12;
		if (top < 10) top = 10;
		if (top + previewRect.height > window.innerHeight - 10) top = window.innerHeight - previewRect.height - 10;

		this.previewElement.css({ left: left + 'px', top: top + 'px' }).addClass('show');

		// Store item id on container for later reference
		this.previewElement.attr('data-item-id', item.id);
	}

	_hidePreview() {
		if (this.previewElement) {
			this.previewElement.removeClass('show pinned');
			this.previewElement.css('pointer-events', 'none');
		}
	}

	/** Mark the currently displayed preview as pinned and set up outside-click to dismiss */
	_pinPreview() {
		if (!this.previewElement) return;
		this.previewPinned = true;
		this.pinnedItemId = this.previewElement.attr('data-item-id');
		this.previewElement.addClass('pinned');
		this.previewElement.css('pointer-events', 'auto');

		// Update hint to "unpin"
		this.previewElement.find('.preview-hint').html('<i class="fas fa-mouse"></i> Middle-click to unpin');

		// Adjust position so the preview doesn't visibly jump when size changes (e.g., hint text)
		const oldRect = this.previewElement[0].getBoundingClientRect();
		// Force reflow to get updated size after hint text change
		const newRect = this.previewElement[0].getBoundingClientRect();
		const dx = (newRect.width - oldRect.width) / 2;
		const dy = (newRect.height - oldRect.height) / 2;
		const newLeft = parseFloat(this.previewElement.css('left')) - dx;
		const newTop = parseFloat(this.previewElement.css('top')) - dy;
		this.previewElement.css({ left: `${newLeft}px`, top: `${newTop}px` });

		// Clicking anywhere outside the preview will unpin it
		const offHandler = ev => {
			if ($(ev.target).closest('.domain-ability-preview').length) return;
			this._unpinPreview();
		};
		// Namespace the handler so we can reliably remove it
		$(document).on('mousedown.domainPreview', offHandler);
	}

	_unpinPreview() {
		this.previewPinned = false;
		this.pinnedItemId = null;
		// Remove outside-click handler
		$(document).off('mousedown.domainPreview');
		// Hide the preview now that it is no longer pinned
		this._hidePreview();
	}

	/** Modify tracker value for an item */
	async _modifyTrackerValue(itemId, trackerId, delta) {
		try {
			const item = this.actor.items.get(itemId);
			if (!item) return;

			const trackers = [...(item.system.resourceTrackers || [])];
			const tracker = trackers.find(t => t.id === trackerId);
			if (!tracker) return;

			const oldValue = tracker.value;
			tracker.value = Math.max(0, tracker.value + delta);
			if (tracker.max !== null) {
				tracker.value = Math.min(tracker.value, tracker.max);
			}

			if (tracker.value !== oldValue) {
				await item.update({ 'system.resourceTrackers': trackers });
				// Re-render to update the bubble display
				this.render();
			}
		} catch (error) {
			console.error('Failed to modify tracker value:', error);
		}
	}

	/** Handle item drops to add new item */
	async _handleDrop(event) {
		const dragEvent = event.originalEvent ?? event;
		const dropTarget = $(event.currentTarget);
		const slotType = dropTarget.data('slot-type');

		if (!slotType) return false;

		const slotConfig = this.slotTypes.find(st => st.key === slotType);
		if (!slotConfig) return false;

		const existingItems = this._getItemsForSlotType(slotConfig);
		if (existingItems.length >= slotConfig.maxSlots) {
			ui.notifications?.warn(`Maximum of ${slotConfig.maxSlots} ${slotConfig.label} items reached.`);
			return false;
		}

		const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(dragEvent);
		if (data.type !== 'Item') return false;

		const item = await Item.implementation.fromDropData(data);
		if (!item) return false;

		if (this.actor.items.has(item.id)) {
			const existing = this.actor.items.get(item.id);
			await existing.update({ 'system.location': slotType });
			this.render();
			return true;
		}

		const newItemData = duplicate(item.toObject());
		newItemData.system = newItemData.system || {};
		newItemData.system.location = slotType;

		await this.actor.createEmbeddedDocuments('Item', [newItemData]);
		this.render();
		return true;
	}
}
