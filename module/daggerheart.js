import { SimpleItem } from './documents/item.js';
import { SimpleActor } from './documents/actor.js';
import { SimpleToken, SimpleTokenDocument } from './documents/token.js';

import { SimpleItemSheet } from './applications/item-sheet.js';
import { SimpleWeaponSheet } from './applications/weapon-sheet.js';
import { SimpleArmorSheet } from './applications/armor-sheet.js';
import { SimpleActorSheet, NPCActorSheet } from './applications/actor-sheet.js';
import { CompanionActorSheet } from './applications/actor-sheet-companion.js';
import { EnvironmentActorSheet } from './applications/actor-sheet-environment.js';
import { preloadHandlebarsTemplates } from './helpers/templates.js';
import {
	createDaggerheartMacro,
	createSpendFearMacro,
	createGainFearMacro,
	createSpendStressMacro,
	createClearStressMacro,
	createSpendHopeMacro,
	createGainHopeMacro,
	spendStress,
	clearStress,
	spendHope,
	gainHope,
} from './data/spending-system.js';
import { CounterUI } from './applications/counter-ui.js';
import { TokenCounterUI } from './applications/token-counter-ui.js';
import { CountdownTracker } from './applications/countdown-tracker.js';
import { TopBarUI } from './applications/top-bar-ui.js';
import { SheetTracker } from './applications/sheet-tracker.js';
import { TrackerNotificationBubbles } from './applications/tracker-notification-bubbles.js';
import { DaggerheartMigrations } from './helpers/migrations.js';
import { EquipmentHandler } from './helpers/equipmentHandler.js';
import { EntitySheetHelper, buildItemCardChat } from './helpers/helper.js';
import { ModifierManager } from './helpers/modifierManager.js';
import { ArmorCleanup } from './helpers/armorCleanup.js';
import { EquipmentSystem } from './helpers/equipmentSystem.js';
import { SpotlightInitiativeTracker, DaggerheartCombat } from './applications/spotlight-initiative.js';

// Dice Customization System
import { DiceAppearanceSettings, getDefaultDiceAppearanceSettings } from './data/settings/DiceAppearanceSettings.mjs';
import { DiceCustomizationHelper } from './helpers/diceCustomization.mjs';
import { DiceCustomizationSettings } from './applications/DiceCustomizationSettings.mjs';
import { RangeMeasurementSettings } from './applications/RangeMeasurementSettings.mjs';
import { FearParticleSettings } from './applications/FearParticleSettings.mjs';

import * as itemData from './data/item/_module.mjs';
import * as actorData from './data/actor/_module.mjs';

// Range Measurement System
import {
	DaggerheartMeasuredTemplate,
	DaggerheartRuler,
	DaggerheartTokenRuler,
	DaggerheartTemplateEnricher,
	renderMeasuredTemplate,
} from './data/range-measurement.js';
import { initializeHoverDistance } from './helpers/hover-distance.js';

import {
	_rollHope,
	_rollFear,
	_rollDuality,
	_rollNPC,
	_checkCritical,
	_enableForcedCritical,
	_disableForcedCritical,
	_isForcedCriticalActive,
	_quickRoll,
	_dualityWithDialog,
	_npcRollWithDialog,
	_waitFor3dDice,
} from './data/rollHandler.js';
import {
	applyDamage,
	applyHealing,
	applyDirectDamage,
	extractRollTotal,
	rollDamage,
	rollDamageWithDialog,
	rollHealing,
	undoDamageHealing,
	debugUndoData,
} from './data/damage-application.js';

// Chat Command System
import './helpers/chat-commands.js';
import './enrichers/_module.js';

function _getTierOfPlay(actor = null, level = null) {
	let characterLevel = level;

	if (characterLevel === null || characterLevel === undefined) {
		if (!actor) {
			console.warn('Daggerheart | getTierOfPlay: No actor or level provided, defaulting to tier 1');
			return 1;
		}
		characterLevel = actor.system?.level?.value || 1;
	}

	characterLevel = parseInt(characterLevel) || 1;
	characterLevel = Math.max(1, Math.min(10, characterLevel));

	if (characterLevel === 1) return 1;
	if (characterLevel >= 2 && characterLevel <= 4) return 2;
	if (characterLevel >= 5 && characterLevel <= 7) return 3;
	if (characterLevel >= 8 && characterLevel <= 10) return 4;

	return 1;
}

Hooks.once('init', async function () {
	console.log(`Initializing Simple Daggerheart System`);

	// Dice customization now uses preset-based approach - no initialization needed
	// Client-scoped settings ensure each user has their own dice appearance preferences
	console.debug('Daggerheart | Dice customization using client-scoped preset-based system');

	CONFIG.statusEffects.push({
		id: 'hidden',
		label: 'Hidden',
		icon: 'icons/svg/invisible.svg',
	});
	CONFIG.statusEffects.push({
		id: 'restrained',
		label: 'Restrained',
		icon: 'icons/svg/padlock.svg',
	});
	CONFIG.statusEffects.push({
		id: 'vulnerable',
		label: 'Vulnerable',
		icon: 'icons/svg/stoned.svg',
	});

	game.daggerheart = {
		SimpleActor,
		createDaggerheartMacro,
		createSpendFearMacro,
		createGainFearMacro,
		createSpendStressMacro,
		createClearStressMacro,
		createSpendHopeMacro,
		createGainHopeMacro,
		spendStress,
		clearStress,
		spendHope,
		gainHope,
		SheetTracker,
		EquipmentHandler,
		ModifierManager,
		ArmorCleanup,
		rollHandler: {
			rollHope: _rollHope,
			rollFear: _rollFear,
			rollDuality: _rollDuality,
			rollNPC: _rollNPC,
			checkCritical: _checkCritical,
			enableForcedCritical: _enableForcedCritical,
			disableForcedCritical: _disableForcedCritical,
			isForcedCriticalActive: _isForcedCriticalActive,
			quickRoll: _quickRoll,
			dualityWithDialog: _dualityWithDialog,
			npcRollWithDialog: _npcRollWithDialog,
			waitFor3dDice: _waitFor3dDice,
		},
		damageApplication: {
			applyDamage: applyDamage,
			applyHealing: applyHealing,
			rollDamage: rollDamage,
			rollDamageWithDialog: rollDamageWithDialog,
			rollHealing: rollHealing,
			extractRollTotal: extractRollTotal,
			undoDamageHealing: undoDamageHealing,
			debugUndoData: debugUndoData,
		},
		getTierOfPlay: _getTierOfPlay,
		EntitySheetHelper: EntitySheetHelper,
		DiceCustomizationHelper: DiceCustomizationHelper,
	};

	globalThis.daggerheart.EntitySheetHelper = EntitySheetHelper;

	CONFIG.Actor.dataModels = actorData.config;
	CONFIG.Actor.documentClass = SimpleActor;
	CONFIG.Actor.typeLabels = {
		character: 'ACTOR.TypeCharacter',
		npc: 'ACTOR.TypeNpc',
		companion: 'ACTOR.TypeCompanion',
		environment: 'ACTOR.TypeEnvironment',
	};

	CONFIG.Item.dataModels = itemData.config;
	CONFIG.Item.documentClass = SimpleItem;
	CONFIG.Item.typeLabels = {
		item: 'ITEM.TypeItem',
		inventory: 'ITEM.TypeInventory',
		worn: 'ITEM.TypeWorn',
		domain: 'ITEM.TypeDomain',
		vault: 'ITEM.Vault',
		ancestry: 'ITEM.TypeAncestry',
		community: 'ITEM.TypeCommunity',
		class: 'ITEM.TypeClass',
		subclass: 'ITEM.TypeSubclass',
		weapon: 'ITEM.TypeWeapon',
		armor: 'ITEM.TypeArmor',
		passive: 'ITEM.TypePassive',
	};

	CONFIG.Token.documentClass = SimpleTokenDocument;
	CONFIG.Token.objectClass = SimpleToken;
	CONFIG.Combat.documentClass = DaggerheartCombat;
	CONFIG.Combat.fallbackTurnMarker = 'systems/daggerheart-unofficial/assets/spotlight.webp';

	CONFIG.Actor.trackableAttributes = CONFIG.Actor.trackableAttributes || {};

	CONFIG.Actor.trackableAttributes['character'] = CONFIG.Actor.trackableAttributes['character'] || {};
	CONFIG.Actor.trackableAttributes['character'].bar = Array.from(
		new Set([
			...(CONFIG.Actor.trackableAttributes['character'].bar || []),
			'hope',
			'armor',
			'health',
			'stress',
			'hopeBar',
			'armorBar',
			'healthBar',
			'stressBar',
		])
	);
	CONFIG.Actor.trackableAttributes['character'].value = Array.from(
		new Set([...(CONFIG.Actor.trackableAttributes['character'].value || [])])
	);

	CONFIG.Actor.trackableAttributes['companion'] = CONFIG.Actor.trackableAttributes['companion'] || {};
	CONFIG.Actor.trackableAttributes['companion'].bar = Array.from(
		new Set([...(CONFIG.Actor.trackableAttributes['companion'].bar || []), 'stress', 'stressBar'])
	);
	CONFIG.Actor.trackableAttributes['companion'].value = Array.from(
		new Set([...(CONFIG.Actor.trackableAttributes['companion'].value || [])])
	);

	CONFIG.Actor.trackableAttributes['npc'] = CONFIG.Actor.trackableAttributes['npc'] || {};
	CONFIG.Actor.trackableAttributes['npc'].bar = Array.from(
		new Set([...(CONFIG.Actor.trackableAttributes['npc'].bar || []), 'health', 'stress', 'healthBar', 'stressBar'])
	);
	CONFIG.Actor.trackableAttributes['npc'].value = Array.from(
		new Set([...(CONFIG.Actor.trackableAttributes['npc'].value || [])])
	);

	CONFIG.Actor.trackableAttributes['environment'] = CONFIG.Actor.trackableAttributes['environment'] || {};
	CONFIG.Actor.trackableAttributes['environment'].bar = Array.from(
		new Set([...(CONFIG.Actor.trackableAttributes['environment'].bar || [])])
	);
	CONFIG.Actor.trackableAttributes['environment'].value = Array.from(
		new Set([...(CONFIG.Actor.trackableAttributes['environment'].value || [])])
	);

	// Register custom canvas classes for range measurement
	CONFIG.MeasuredTemplate.objectClass = DaggerheartMeasuredTemplate;
	CONFIG.Canvas.rulerClass = DaggerheartRuler;
	CONFIG.Token.rulerClass = DaggerheartTokenRuler;

	foundry.documents.collections.Actors.unregisterSheet('core', foundry.applications.sheets.ActorSheetV2);
	foundry.documents.collections.Actors.registerSheet('daggerheart-unofficial', SimpleActorSheet, {
		types: ['character'],
		makeDefault: true,
		label: 'SHEET.Actor.character',
	});
	foundry.documents.collections.Actors.registerSheet('daggerheart-unofficial', NPCActorSheet, {
		types: ['npc'],
		makeDefault: true,
		label: 'SHEET.Actor.npc',
	});
	foundry.documents.collections.Actors.registerSheet('daggerheart-unofficial', CompanionActorSheet, {
		types: ['companion'],
		makeDefault: true,
		label: 'SHEET.Actor.companion',
	});
	foundry.documents.collections.Actors.registerSheet('daggerheart-unofficial', EnvironmentActorSheet, {
		types: ['environment'],
		makeDefault: true,
		label: 'SHEET.Actor.environment',
	});
	foundry.documents.collections.Items.unregisterSheet('core', foundry.applications.sheets.ItemSheetV2);
	foundry.documents.collections.Items.registerSheet('daggerheart-unofficial', SimpleItemSheet, {
		types: ['item', 'inventory', 'worn', 'domain', 'vault', 'ancestry', 'community', 'class', 'subclass', 'passive'],
		makeDefault: true,
		label: 'SHEET.Item.default',
	});
	foundry.documents.collections.Items.registerSheet('daggerheart-unofficial', SimpleWeaponSheet, {
		types: ['weapon'],
		makeDefault: true,
		label: 'SHEET.Item.weapon',
	});
	foundry.documents.collections.Items.registerSheet('daggerheart-unofficial', SimpleArmorSheet, {
		types: ['armor'],
		makeDefault: true,
		label: 'SHEET.Item.armor',
	});

	game.settings.register('daggerheart-unofficial', 'counterValue', {
		name: 'Counter Value',
		hint: 'The current value of the counter',
		scope: 'world',
		type: Number,
		default: 0,
		config: false,
	});

	game.settings.register('daggerheart-unofficial', 'countdownTrackers', {
		name: 'Countdown Trackers',
		hint: 'Persistent countdown/progress tracker data',
		scope: 'world',
		type: Array,
		default: [],
		config: false,
	});

	game.settings.register('daggerheart-unofficial', 'activeEnvironment', {
		name: 'Active Environment UUID',
		hint: 'Stores the active Environment actor UUID',
		scope: 'world',
		type: String,
		default: '',
		config: false,
	});

	game.settings.register('daggerheart-unofficial', 'advantageDieTypes', {
		name: 'SETTINGS.AdvantageDieTypesN',
		hint: 'SETTINGS.AdvantageDieTypesL',
		scope: 'world',
		config: true,
		type: String,
		default: 'd4,d6,d8,d10',
	});

	game.settings.register('daggerheart-unofficial', 'experimentalFeatures', {
		name: 'Experimental Features',
		hint: 'Enable in-development UI features',
		scope: 'client',
		config: true,
		type: Boolean,
		default: false,
	});

	game.settings.register('daggerheart-unofficial', 'fearParticleSettings', {
		name: 'Fear Particle Settings',
		hint: 'Configure fear animation particles per client',
		scope: 'client',
		config: false,
		type: Object,
		default: { count: 8, smoke: true, icon: 'fa-duotone fa-skull', scale: 1 },
	});

	// Register range measurement settings
	game.settings.register('daggerheart-unofficial', 'rangeMeasurementEnabled', {
		name: 'DAGGERHEART.SETTINGS.RangeMeasurement.enabled',
		hint: "Enable narrative range measurement display (scenes using 'mi' or 'km' as units are exempt)",
		scope: 'world',
		config: false,
		type: Boolean,
		default: true,
		restricted: true,
	});

	game.settings.register('daggerheart-unofficial', 'hoverDistanceVerticalMode', {
		name: 'DAGGERHEART.SETTINGS.Hover.Distance.Vertical.mode',
		hint: "Define how vertical distance is computed ('useCoreRuler', 'useHighest', 'euclidean', 'ignore')",
		scope: 'world',
		config: false,
		type: String,
		default: 'ignore',
		restricted: true,
	});

	game.settings.register('daggerheart-unofficial', 'hoverDistanceRounding', {
		name: 'DAGGERHEART.CONFIG.Hover.Distance.Rounding.value',
		hint: 'Distance threshold for Melee range (in grid units)',
		scope: 'world',
		config: false,
		type: Number,
		default: 0,
		restricted: true,
	});

	game.settings.register('daggerheart-unofficial', 'hoverDistanceComplexityThreshold', {
		name: 'DAGGERHEART.CONFIG.Hover.Distance.Complexity.Threshold.value',
		hint: 'Distance threshold for Melee range (in grid units)',
		scope: 'world',
		config: false,
		type: Number,
		default: 400,
		restricted: true,
	});

	game.settings.register('daggerheart-unofficial', 'hoverDistanceTooltipPosition', {
		name: 'DAGGERHEART.SETTINGS.HoverDistance.tooltipPosition',
		hint: 'DAGGERHEART.SETTINGS.HoverDistance.tooltipPositionHint',
		scope: 'client',
		config: true,
		type: String,
		choices: {
			above: 'DAGGERHEART.SETTINGS.HoverDistance.tooltipPositionAbove',
			below: 'DAGGERHEART.SETTINGS.HoverDistance.tooltipPositionBelow',
		},
		default: 'above',
	});

	game.settings.register('daggerheart-unofficial', 'rangeMeasurementMelee', {
		name: 'DAGGERHEART.CONFIG.Range.melee.name',
		hint: 'Distance threshold for Melee range (in grid units)',
		scope: 'world',
		config: false,
		type: Number,
		default: 1,
		restricted: true,
	});

	game.settings.register('daggerheart-unofficial', 'rangeMeasurementVeryClose', {
		name: 'DAGGERHEART.CONFIG.Range.veryClose.name',
		hint: 'Distance threshold for Very Close range (in grid units)',
		scope: 'world',
		config: false,
		type: Number,
		default: 3,
		restricted: true,
	});

	game.settings.register('daggerheart-unofficial', 'rangeMeasurementClose', {
		name: 'DAGGERHEART.CONFIG.Range.close.name',
		hint: 'Distance threshold for Close range (in grid units)',
		scope: 'world',
		config: false,
		type: Number,
		default: 6,
		restricted: true,
	});

	game.settings.register('daggerheart-unofficial', 'rangeMeasurementFar', {
		name: 'DAGGERHEART.CONFIG.Range.far.name',
		hint: 'Distance threshold for Far range (in grid units)',
		scope: 'world',
		config: false,
		type: Number,
		default: 12,
		restricted: true,
	});

	game.settings.register('daggerheart-unofficial', 'rangeMeasurementVeryFar', {
		name: 'DAGGERHEART.CONFIG.Range.veryFar.name',
		hint: 'Distance threshold for Very Far range (in grid units)',
		scope: 'world',
		config: false,
		type: Number,
		default: 18,
		restricted: true,
	});

	// Simple Adversary Sheets setting
	game.settings.register('daggerheart-unofficial', 'simpleAdversarySheets', {
		name: 'SETTINGS.SimpleAdversarySheetsN',
		hint: 'SETTINGS.SimpleAdversarySheetsL',
		scope: 'client',
		config: true,
		type: Boolean,
		default: false,
	});

	// Dice Appearance Customization Settings
	game.settings.register('daggerheart-unofficial', 'diceAppearance', {
		name: 'DAGGERHEART.SETTINGS.DiceCustomization.name',
		hint: 'DAGGERHEART.SETTINGS.DiceCustomization.hint',
		scope: 'client',
		config: false, // Hidden from standard config menu since we have a custom UI
		type: Object,
		default: getDefaultDiceAppearanceSettings(),
		onChange: async value => {
			// Validate settings before processing
			console.debug('Daggerheart | Dice appearance settings changed, validating and re-registering colorsets');

			try {
				// Import validation function
				const { validateDiceAppearanceSettings } = await import('./data/settings/DiceAppearanceSettings.mjs');

				// Validate the new settings
				const validatedSettings = validateDiceAppearanceSettings(value);

				// If validation changed the settings, update them
				if (JSON.stringify(validatedSettings) !== JSON.stringify(value)) {
					console.warn('Daggerheart | Settings were corrected during validation, updating stored settings');
					await game.settings.set('daggerheart-unofficial', 'diceAppearance', validatedSettings);
					return; // This will trigger onChange again with corrected settings
				}

				// Settings have been updated - no additional action needed for preset-based system
				// Each roll will generate presets on-demand using the new settings
				console.debug('Daggerheart | Dice appearance settings updated successfully');
			} catch (error) {
				console.error('Daggerheart | Failed to process dice appearance settings change:', error);
				console.warn('Daggerheart | Dice customization may not work properly due to settings error');
			}
		},
	});

	// Register dice customization settings menu
	game.settings.registerMenu('daggerheart-unofficial', 'diceCustomizationMenu', {
		name: 'DAGGERHEART.SETTINGS.DiceCustomization.menuName',
		label: 'DAGGERHEART.SETTINGS.DiceCustomization.menuLabel',
		hint: 'DAGGERHEART.SETTINGS.DiceCustomization.menuHint',
		icon: 'fas fa-dice',
		type: DiceCustomizationSettings,
	});

	// Register range measurement settings menu
	game.settings.registerMenu('daggerheart-unofficial', 'rangeMeasurementMenu', {
		name: 'DAGGERHEART.SETTINGS.RangeMeasurement.title',
		label: 'DAGGERHEART.SETTINGS.RangeMeasurement.menuLabel',
		hint: 'DAGGERHEART.SETTINGS.RangeMeasurement.menuHint',
		icon: 'fas fa-ruler-combined',
		type: RangeMeasurementSettings,
		restricted: true,
	});

	game.settings.registerMenu('daggerheart-unofficial', 'fearParticleMenu', {
		name: 'Fear Particle Settings',
		label: 'Fear Particles',
		hint: 'Configure fear particle count, smoke, icon and scale',
		icon: 'fas fa-skull',
		type: FearParticleSettings,
	});

	Handlebars.registerHelper('slugify', function (value) {
		return value.slugify({ strict: true });
	});

	// Register template enricher for chat integration
	CONFIG.TextEditor.enrichers.push({
		pattern: /@Template\[([^\]]+)\]/g,
		enricher: DaggerheartTemplateEnricher,
	});

	await preloadHandlebarsTemplates();
});

Hooks.on('updateActor', (actor, data, options, userId) => {
	if (data.system && (data.system['weapon-main'] || data.system['weapon-off'])) {
		Object.values(actor.apps).forEach(app => {
			if (app.render) {
				try {
					app.render(true);
				} catch (error) {}
			}
		});
	}
});

Hooks.on('updateItem', async (item, data, options, userId) => {
	if (item.type !== 'weapon') return;

	const actor = item.parent;
	if (!actor) return;

	const isEquipped = item.system.equipped;
	const hasDataChanges =
		data.system &&
		(data.system.damage !== undefined ||
			data.system.trait !== undefined ||
			data.system.range !== undefined ||
			data.system.damageType !== undefined ||
			data.system.category !== undefined ||
			data.system.tier !== undefined);

	if (data.system?.equipped !== undefined) {
	}

	if (hasDataChanges && isEquipped) {
	}

	if (data.system?.equipped !== undefined || (hasDataChanges && isEquipped)) {
		const actorSheet = Object.values(actor.apps).find(app => app.constructor.name.includes('ActorSheet'));

		if (actorSheet) {
			try {
				await EquipmentHandler.syncEquippedWeapons(actor, actorSheet);
				actorSheet.render(true);
			} catch (error) {}
		}
	}
});

Hooks.on('updateItem', async (item, data, options, userId) => {
	try {
		if (item.type !== 'armor') return;
		const actor = item.parent;
		if (!actor) return;

		const isEquipped = item.system?.equipped === true;
		const equippedChanged = data.system?.equipped !== undefined;
		const armorFieldsChanged = !!(data.system?.baseScore || data.system?.baseThresholds);

		if (equippedChanged) {
			if (data.system.equipped === true) {
				await EquipmentSystem._applyArmorModifiers(actor, item);
			} else {
				await EquipmentSystem._removeArmorModifiers(actor, item);
			}
			return;
		}

		if (isEquipped && armorFieldsChanged) {
			await EquipmentSystem._applyArmorModifiers(actor, item);
		}
	} catch (e) {
		console.error('Daggerheart | Armor update handling failed', e);
	}
});

Hooks.on('preDeleteItem', async (item, options, userId) => {
	try {
		const actor = item.parent;
		if (!actor) return;
		if (item.type !== 'armor') return;
		if (item.system?.equipped !== true) return;
		await EquipmentSystem._removeArmorModifiers(actor, item);
	} catch (e) {
		console.error('Daggerheart | Failed armor modifier cleanup on delete', e);
	}
});

Hooks.on('hotbarDrop', (bar, data, slot) => {
	if (data.type === 'Item') {
		createDaggerheartMacro(data, slot);
		return false;
	}
	return createDaggerheartMacro(data, slot);
});

Hooks.once('ready', async function () {
	if (game.user.isGM) {
		await DaggerheartMigrations.migrateWorld();
	}

	game.daggerheart.counter = new CounterUI();
	await game.daggerheart.counter.initialize();

	game.daggerheart.tokenCounter = new TokenCounterUI();
	await game.daggerheart.tokenCounter.initialize();

	game.daggerheart.countdownTracker = new CountdownTracker();
	await game.daggerheart.countdownTracker.initialize();

	if (game.settings.get('daggerheart-unofficial', 'experimentalFeatures')) {
		game.daggerheart.topBarUI = new TopBarUI();
		await game.daggerheart.topBarUI.initialize();
	} else {
		const wrapper = document.getElementById('top-bar-wrapper');
		if (wrapper) wrapper.remove();
	}

	Hooks.on('updateActor', async (actor, data) => {
		try {
			const active = game.settings.get('daggerheart-unofficial', 'activeEnvironment');
			if (active && actor?.uuid === active) {
				await game.daggerheart.topBarUI?.initialize();
			}
		} catch {}
	});

	// Initialize tracker notification bubbles
	game.daggerheart.trackerNotificationBubbles = new TrackerNotificationBubbles();
	game.daggerheart.trackerNotificationBubbles.initialize();

	// Initialize spotlight initiative tracker
	SpotlightInitiativeTracker.initialize();

	// Dice customization system is now preset-based and client-scoped
	console.debug('Daggerheart | Dice customization uses client-scoped presets - no initialization required');

	// Add event listeners for template buttons in chat
	Hooks.on('renderChatMessage', (message, html, data) => {
		html.find('.measured-template-button').on('click', renderMeasuredTemplate);
	});

	initializeHoverDistance();

	// Initialize hover distance feature
	initializeHoverDistance();

	// Register hover distance for debugging and access
	game.daggerheart.hoverDistance = {
		initialize: initializeHoverDistance,
	};

	window.spendFear = async function (amount) {
		if (!game.daggerheart?.counter) {
			console.error('Fear counter not initialized');
			ui.notifications.error('Fear counter not available');
			return false;
		}
		return await game.daggerheart.counter.spendFear(amount);
	};

	window.gainFear = async function (amount) {
		if (!game.daggerheart?.counter) {
			console.error('Fear counter not initialized');
			ui.notifications.error('Fear counter not available');
			return false;
		}
		return await game.daggerheart.counter.gainFear(amount);
	};

	window.spendStress = async function (actor, amount) {
		if (!game.daggerheart?.spendStress) {
			console.error('spendStress function not initialized');
			ui.notifications.error('spendStress function not available');
			return false;
		}
		return await game.daggerheart.spendStress(actor, amount);
	};

	window.clearStress = async function (actor, amount) {
		if (!game.daggerheart?.clearStress) {
			console.error('clearStress function not initialized');
			ui.notifications.error('clearStress function not available');
			return false;
		}
		return await game.daggerheart.clearStress(actor, amount);
	};

	window.spendHope = async function (actor, amount) {
		if (!game.daggerheart?.spendHope) {
			console.error('spendHope function not initialized');
			ui.notifications.error('spendHope function not available');
			return false;
		}
		return await game.daggerheart.spendHope(actor, amount);
	};

	window.gainHope = async function (actor, amount) {
		if (!game.daggerheart?.gainHope) {
			console.error('gainHope function not initialized');
			ui.notifications.error('gainHope function not available');
			return false;
		}
		return await game.daggerheart.gainHope(actor, amount);
	};

	window.testFearAutomation = async function () {
		console.log('=== Daggerheart | Starting Global Automation Test ===');

		console.log('\n--- Test 1: Standalone Fear Roll ---');
		await game.daggerheart.rollHandler.rollFear({
			sendToChat: true,
			flavor: "<p class='roll-flavor-line'><b>Test Fear Roll</b> (should trigger +1 Fear globally)</p>",
		});

		await new Promise(resolve => setTimeout(resolve, 500));

		console.log('\n--- Test 2: Duality Roll ---');
		await game.daggerheart.rollHandler.rollDuality({
			sendToChat: true,
			flavor: "<p class='roll-flavor-line'><b>Test Duality Roll</b> (automation depends on result)</p>",
		});

		await new Promise(resolve => setTimeout(resolve, 500));

		console.log('\n--- Test 3: Duality Dialog (No Actor) ---');
		await game.daggerheart.rollHandler.dualityWithDialog({
			title: 'Test Duality (No Actor)',
			skipDialog: true,
			rollDetails: { modifier: 0, advantage: 0, disadvantage: 0 },
		});

		console.log('\n=== Test completed! Check the console output above and look for automation messages ===');
		ui.notifications.info('Global automation test completed. Check console for detailed output.');
	};

	window.testWeaponEquip = async function () {
		const selectedTokens = canvas.tokens.controlled;
		if (selectedTokens.length === 0) {
			ui.notifications.warn('Please select a token first');
			return;
		}

		const actor = selectedTokens[0].actor;
		const weapons = actor.items.filter(i => i.type === 'weapon');

		if (weapons.length === 0) {
			ui.notifications.warn('This actor has no weapons');
			return;
		}

		console.log('=== Weapon Equip Test (Dual System) ===');
		console.log('Actor:', actor.name);
		console.log(
			'Weapons:',
			weapons.map(w => `${w.name} (equipped: ${w.system.equipped}, slot: ${w.system.weaponSlot})`)
		);
		console.log('Current weapon-main damage:', actor.system['weapon-main']?.damage);
		console.log('Current weapon-main to-hit:', actor.system['weapon-main']?.['to-hit']);
		console.log('Current weapon-off damage:', actor.system['weapon-off']?.damage);
		console.log('Current weapon-off to-hit:', actor.system['weapon-off']?.['to-hit']);

		const weapon = weapons[0];
		console.log('Testing with weapon:', weapon.name);
		console.log('Weapon system data:', weapon.system);
		console.log('Weapon damage (raw):', weapon.system.damage);
		console.log('Weapon damage type:', typeof weapon.system.damage);
		console.log('Weapon damage structure:', JSON.stringify(weapon.system.damage, null, 2));
		console.log('Weapon trait:', weapon.system.trait);
		console.log('Current weapon slot:', weapon.system.weaponSlot);

		const sheet = Object.values(actor.apps).find(app => app.constructor.name.includes('ActorSheet'));
		if (!sheet) {
			ui.notifications.warn('Please open the character sheet first');
			return;
		}

		console.log('=== Testing Primary Weapon Equip ===');
		const successPrimary = await EquipmentHandler.equipPrimaryWeapon(actor, weapon);
		if (successPrimary) {
			console.log('Primary weapon equip successful');
			await EquipmentHandler.syncEquippedWeapons(actor, sheet);
			console.log('Primary weapon sync completed');
			sheet.render(true, { immediate: true });

			console.log('New weapon-main damage:', actor.system['weapon-main']?.damage);
			console.log('New weapon-main to-hit:', actor.system['weapon-main']?.['to-hit']);
			console.log('Updated weapon slot:', weapon.system.weaponSlot);
			console.log('Primary weapon test completed - check the sheet!');
		} else {
			console.log('Primary weapon equip failed');
		}
	};

	window.testSecondaryWeapon = async function () {
		const selectedTokens = canvas.tokens.controlled;
		if (selectedTokens.length === 0) {
			ui.notifications.warn('Please select a token first');
			return;
		}

		const actor = selectedTokens[0].actor;
		const weapons = actor.items.filter(i => i.type === 'weapon');

		if (weapons.length < 2) {
			ui.notifications.warn('This actor needs at least 2 weapons to test secondary');
			return;
		}

		const weapon = weapons[1];
		console.log('=== Testing Secondary Weapon Equip ===');
		console.log('Testing with weapon:', weapon.name);

		const sheet = Object.values(actor.apps).find(app => app.constructor.name.includes('ActorSheet'));
		if (!sheet) {
			ui.notifications.warn('Please open the character sheet first');
			return;
		}

		const successSecondary = await EquipmentHandler.equipSecondaryWeapon(actor, weapon);
		if (successSecondary) {
			console.log('Secondary weapon equip successful');
			await EquipmentHandler.syncEquippedWeapons(actor, sheet);
			console.log('Secondary weapon sync completed');
			sheet.render(true, { immediate: true });

			console.log('New weapon-off damage:', actor.system['weapon-off']?.damage);
			console.log('New weapon-off to-hit:', actor.system['weapon-off']?.['to-hit']);
			console.log('Updated weapon slot:', weapon.system.weaponSlot);
			console.log('Secondary weapon test completed - check the sheet!');
		} else {
			console.log('Secondary weapon equip failed');
		}
	};

	window.debugWeaponData = function () {
		const selectedTokens = canvas.tokens.controlled;
		if (selectedTokens.length === 0) {
			ui.notifications.warn('Please select a token first');
			return;
		}

		const actor = selectedTokens[0].actor;
		console.log('=== Weapon Data Debug ===');
		console.log('Actor:', actor.name);
		console.log('weapon-main damage:', JSON.stringify(actor.system['weapon-main']?.damage, null, 2));
		console.log('weapon-main to-hit:', JSON.stringify(actor.system['weapon-main']?.['to-hit'], null, 2));
		console.log('weapon-off damage:', JSON.stringify(actor.system['weapon-off']?.damage, null, 2));
		console.log('weapon-off to-hit:', JSON.stringify(actor.system['weapon-off']?.['to-hit'], null, 2));
		console.log('Base value restrictions:', JSON.stringify(actor.flags?.daggerheart?.baseValueRestrictions, null, 2));
	};

	window.testWeaponSystem = function () {
		const selectedTokens = canvas.tokens.controlled;
		if (selectedTokens.length === 0) {
			ui.notifications.warn('Please select a token first');
			return;
		}

		const actor = selectedTokens[0].actor;
		console.log('=== New Weapon System Test ===');
		console.log('Actor:', actor.name);
		console.log('Primary weapon data:', EquipmentHandler.getDynamicWeaponData(actor, 'primary'));
		console.log('Secondary weapon data:', EquipmentHandler.getDynamicWeaponData(actor, 'secondary'));
		console.log('Weapon display data:', EquipmentHandler.getWeaponDisplayData(actor));
	};

	window.testWeaponScenario = function () {
		const selectedTokens = canvas.tokens.controlled;
		if (selectedTokens.length === 0) {
			ui.notifications.warn('Please select a token first');
			return;
		}

		const actor = selectedTokens[0].actor;
		console.log('=== Weapon System Test Scenario ===');
		console.log('Actor:', actor.name);

		const strength = foundry.utils.getProperty(actor, 'system.strength.value') ?? 0;
		console.log(`Character strength modifier: ${strength}`);

		const primaryWeapon = EquipmentHandler.getPrimaryWeapon(actor);
		if (primaryWeapon) {
			console.log(`\nPrimary weapon: ${primaryWeapon.name}`);

			const weaponTotalDamage = EquipmentHandler.getWeaponTotalDamage(primaryWeapon, actor);
			console.log(`Weapon total damage: ${weaponTotalDamage}`);

			const weaponTraitValue = EquipmentHandler.getWeaponTraitValue(primaryWeapon, actor);
			console.log(`Weapon trait value: ${weaponTraitValue}`);

			const weaponData = EquipmentHandler.getDynamicWeaponData(actor, 'primary');
			console.log('\nFinal character sheet data:');
			console.log(`- Attack modifier base: ${weaponData['to-hit'].baseValue}`);
			console.log(`- Attack modifier total: ${weaponData['to-hit'].value}`);
			console.log(`- Damage base: ${weaponData.damage.baseValue}`);
			console.log(`- Damage total: ${weaponData.damage.value}`);
			console.log(`- Character modifiers preserved:`, weaponData['to-hit'].modifiers);

			console.log('\n✅ This demonstrates the correct separation:');
			console.log("- Weapon damage (1d12 + 1d6 + 2) becomes character's base value");
			console.log('- Character modifiers (+2 blessing) stay as character modifiers');
			console.log('- Final result: (1d12 + 1d6 + 2) + 2');
		} else {
			console.log('No primary weapon equipped');
		}

		const secondaryWeapon = EquipmentHandler.getSecondaryWeapon(actor);
		if (secondaryWeapon) {
			console.log(`\nSecondary weapon: ${secondaryWeapon.name}`);
			const secondaryData = EquipmentHandler.getDynamicWeaponData(actor, 'secondary');
			console.log('Secondary weapon data:', secondaryData);
		}
	};

	window.debugWeaponDamage = function () {
		const selectedTokens = canvas.tokens.controlled;
		if (selectedTokens.length === 0) {
			ui.notifications.warn('Please select a token first');
			return;
		}

		const actor = selectedTokens[0].actor;
		console.log('=== Weapon Damage Debug ===');
		console.log('Actor:', actor.name);

		const weapons = actor.items.filter(i => i.type === 'weapon');
		console.log('\n--- All Weapons ---');
		weapons.forEach(weapon => {
			console.log(`${weapon.name}:`);
			console.log('  Raw damage data:', weapon.system.damage);
			console.log('  Equipped:', weapon.system.equipped);
			console.log('  Slot:', weapon.system.weaponSlot);

			if (typeof weapon.system.damage === 'object') {
				console.log('  - baseValue:', weapon.system.damage.baseValue);
				console.log('  - value:', weapon.system.damage.value);
				console.log('  - modifiers:', weapon.system.damage.modifiers);
			}
		});

		console.log('\n--- Character Weapon Slots ---');
		console.log('Primary weapon slot:', JSON.stringify(actor.system['weapon-main'], null, 2));
		console.log('Secondary weapon slot:', JSON.stringify(actor.system['weapon-off'], null, 2));

		console.log('\n--- Dynamic Resolution Test ---');
		const primaryWeapon = EquipmentHandler.getPrimaryWeapon(actor);
		const secondaryWeapon = EquipmentHandler.getSecondaryWeapon(actor);

		if (primaryWeapon) {
			console.log('Primary weapon resolved data:');
			const resolvedPrimary = EquipmentHandler.getResolvedWeaponData(actor, 'primary');
			console.log(JSON.stringify(resolvedPrimary, null, 2));
		}

		if (secondaryWeapon) {
			console.log('Secondary weapon resolved data:');
			const resolvedSecondary = EquipmentHandler.getResolvedWeaponData(actor, 'secondary');
			console.log(JSON.stringify(resolvedSecondary, null, 2));
		}
	};

	game.daggerheart.damageApplication = {
		applyDamage,
		applyHealing,
		applyDirectDamage,
		rollDamage,
		rollDamageWithDialog,
		rollHealing,
		undoDamageHealing,
		debugUndoData,
	};
	game.daggerheart.damageApplication.rollConsolidatedDamage = _rollConsolidatedDamage;

	game.daggerheart.spendFear = window.spendFear;
	game.daggerheart.gainFear = window.gainFear;

	window.applyDamage = async function (targetActor, damageAmount, sourceActor, createUndo = true, armorSlotsUsed = 0) {
		if (!game.daggerheart?.damageApplication?.applyDamage) {
			console.error('Damage application not initialized');
			ui.notifications.error('Damage application not available');
			return false;
		}
		return await game.daggerheart.damageApplication.applyDamage(
			targetActor,
			damageAmount,
			sourceActor,
			createUndo,
			armorSlotsUsed
		);
	};

	window.applyHealing = async function (targetActor, healAmount, sourceActor) {
		if (!game.daggerheart?.damageApplication?.applyHealing) {
			console.error('Healing application not initialized');
			ui.notifications.error('Healing application not available');
			return false;
		}
		return await game.daggerheart.damageApplication.applyHealing(targetActor, healAmount, sourceActor);
	};

	window.applyDirectDamage = async function (targetActor, hpDamage, sourceActor, createUndo = true) {
		if (!game.daggerheart?.damageApplication?.applyDirectDamage) {
			console.error('Direct damage application not initialized');
			ui.notifications.error('Direct damage application not available');
			return false;
		}
		return await game.daggerheart.damageApplication.applyDirectDamage(targetActor, hpDamage, sourceActor, createUndo);
	};

	window.rollDamage = async function (formula, options) {
		if (!game.daggerheart?.damageApplication?.rollDamage) {
			console.error('Damage rolling not initialized');
			ui.notifications.error('Damage rolling not available');
			return null;
		}
		return await game.daggerheart.damageApplication.rollDamage(formula, options);
	};

	window.rollDamageWithDialog = async function (formula, options) {
		if (!game.daggerheart?.damageApplication?.rollDamageWithDialog) {
			console.error('Damage rolling with dialog not initialized');
			ui.notifications.error('Damage rolling with dialog not available');
			return null;
		}
		return await game.daggerheart.damageApplication.rollDamageWithDialog(formula, options);
	};

	window.rollHealing = async function (formula, options) {
		if (!game.daggerheart?.damageApplication?.rollHealing) {
			console.error('Healing rolling not initialized');
			ui.notifications.error('Healing rolling not available');
			return null;
		}
		return await game.daggerheart.damageApplication.rollHealing(formula, options);
	};

	window.undoDamageHealing = async function (undoId) {
		if (!game.daggerheart?.damageApplication?.undoDamageHealing) {
			console.error('Undo functionality not initialized');
			ui.notifications.error('Undo functionality not available');
			return false;
		}
		return await game.daggerheart.damageApplication.undoDamageHealing(undoId);
	};

	window.debugUndoData = function (undoId) {
		if (!game.daggerheart?.damageApplication?.debugUndoData) {
			console.error('Debug functionality not initialized');
			return;
		}
		return game.daggerheart.damageApplication.debugUndoData(undoId);
	};

	// Test function for Simple Adversary Sheets
	window.testSimpleAdversarySheets = function () {
		const currentSetting = game.settings.get('daggerheart-unofficial', 'simpleAdversarySheets');
		console.log('Current Simple Adversary Sheets setting:', currentSetting);

		const npcs = game.actors.filter(a => a.type === 'npc');
		console.log(
			'Found NPCs:',
			npcs.map(n => n.name)
		);

		if (npcs.length === 0) {
			ui.notifications.warn('No NPCs found to test with');
			return;
		}

		const testNPC = npcs[0];
		console.log('Testing with NPC:', testNPC.name);

		// Try to open the sheet
		testNPC.sheet.render(true);

		ui.notifications.info(
			`Simple Adversary Sheets test completed. Setting is ${currentSetting ? 'enabled' : 'disabled'}.`
		);
	};

	game.daggerheart.applyDamage = window.applyDamage;
	game.daggerheart.applyHealing = window.applyHealing;
	game.daggerheart.applyDirectDamage = window.applyDirectDamage;
	game.daggerheart.rollDamage = window.rollDamage;
	game.daggerheart.rollDamageWithDialog = window.rollDamageWithDialog;
	game.daggerheart.rollHealing = window.rollHealing;
	game.daggerheart.undoDamageHealing = window.undoDamageHealing;
	game.daggerheart.debugUndoData = window.debugUndoData;

	window.addModifier = function (actorName, fieldPath, modifierName, modifierValue, options = {}) {
		console.warn(
			'Global addModifier() using actor names is DEPRECATED. Use addModifierById() or addModifierByRef() instead. Actor names are not unique and may cause issues.'
		);
		if (!game.daggerheart?.ModifierManager) {
			console.error('ModifierManager not initialized');
			ui.notifications.error('ModifierManager not available');
			return false;
		}
		return game.daggerheart.ModifierManager.addModifierByName(
			actorName,
			fieldPath,
			modifierName,
			modifierValue,
			options
		);
	};

	window.removeModifier = function (actorName, fieldPath, modifierName) {
		console.warn(
			'Global removeModifier() using actor names is DEPRECATED. Use removeModifierById() or removeModifierByRef() instead. Actor names are not unique and may cause issues.'
		);
		if (!game.daggerheart?.ModifierManager) {
			console.error('ModifierManager not initialized');
			ui.notifications.error('ModifierManager not available');
			return false;
		}
		return game.daggerheart.ModifierManager.removeModifierByName(actorName, fieldPath, modifierName);
	};

	window.listModifiers = function (actorName) {
		console.warn(
			'Global listModifiers() using actor names is DEPRECATED. Use listModifiersById() or listModifiersByRef() instead. Actor names are not unique and may cause issues.'
		);
		if (!game.daggerheart?.ModifierManager) {
			console.error('ModifierManager not initialized');
			ui.notifications.error('ModifierManager not available');
			return {};
		}
		return game.daggerheart.ModifierManager.listAllModifiersByName(actorName);
	};

	window.addModifierById = function (actorId, fieldPath, modifierName, modifierValue, options = {}) {
		if (!game.daggerheart?.ModifierManager) {
			console.error('ModifierManager not initialized');
			ui.notifications.error('ModifierManager not available');
			return false;
		}
		return game.daggerheart.ModifierManager.addModifierById(actorId, fieldPath, modifierName, modifierValue, options);
	};

	window.removeModifierById = function (actorId, fieldPath, modifierName) {
		if (!game.daggerheart?.ModifierManager) {
			console.error('ModifierManager not initialized');
			ui.notifications.error('ModifierManager not available');
			return false;
		}
		return game.daggerheart.ModifierManager.removeModifierById(actorId, fieldPath, modifierName);
	};

	window.listModifiersById = function (actorId) {
		if (!game.daggerheart?.ModifierManager) {
			console.error('ModifierManager not initialized');
			ui.notifications.error('ModifierManager not available');
			return {};
		}
		return game.daggerheart.ModifierManager.getModifiersById(actorId);
	};

	window.addModifierByRef = function (actorRef, fieldPath, modifierName, modifierValue, options = {}) {
		if (!game.daggerheart?.ModifierManager) {
			console.error('ModifierManager not initialized');
			ui.notifications.error('ModifierManager not available');
			return false;
		}
		return game.daggerheart.ModifierManager.addModifierByRef(actorRef, fieldPath, modifierName, modifierValue, options);
	};

	window.removeModifierByRef = function (actorRef, fieldPath, modifierName) {
		if (!game.daggerheart?.ModifierManager) {
			console.error('ModifierManager not initialized');
			ui.notifications.error('ModifierManager not available');
			return false;
		}
		return game.daggerheart.ModifierManager.removeModifierByRef(actorRef, fieldPath, modifierName);
	};

	window.listModifiersByRef = function (actorRef) {
		if (!game.daggerheart?.ModifierManager) {
			console.error('ModifierManager not initialized');
			ui.notifications.error('ModifierManager not available');
			return {};
		}
		return game.daggerheart.ModifierManager.getModifiersByRef(actorRef);
	};

	window.listModifiersByRef = function (actorRef) {
		if (!game.daggerheart?.ModifierManager) {
			console.error('ModifierManager not initialized');
			ui.notifications.error('ModifierManager not available');
			return {};
		}
		return game.daggerheart.ModifierManager.getModifiersByRef(actorRef);
	};

	game.daggerheart.addModifier = window.addModifier;
	game.daggerheart.removeModifier = window.removeModifier;
	game.daggerheart.listModifiers = window.listModifiers;

	game.daggerheart.addModifierById = window.addModifierById;
	game.daggerheart.removeModifierById = window.removeModifierById;
	game.daggerheart.listModifiersById = window.listModifiersById;

	game.daggerheart.addModifierByRef = window.addModifierByRef;
	game.daggerheart.removeModifierByRef = window.removeModifierByRef;
	game.daggerheart.listModifiersByRef = window.listModifiersByRef;

	window.cleanupDuplicateMacros = _cleanupDuplicateMacros;
	game.daggerheart.cleanupDuplicateMacros = window.cleanupDuplicateMacros;

	window.testModifierSystem = function () {
		const selectedTokens = canvas.tokens.controlled;
		if (selectedTokens.length === 0) {
			ui.notifications.warn('Please select a token first');
			return;
		}

		const actor = selectedTokens[0].actor;
		console.log('=== ModifierManager Test ===');
		console.log('Actor:', actor.name);

		console.log('\n--- Testing Add Modifiers ---');

		console.log('Adding +2 blessing to strength...');
		const result1 = addModifier(actor.name, 'strength', 'Blessing', 2, { color: '#00ff00' });
		console.log('Result:', result1 ? 'Success' : 'Failed');

		console.log('Adding +1 enhancement to weapon-main.to-hit...');
		const result2 = addModifier(actor.name, 'weapon-main.to-hit', 'Enhancement', 1, { color: '#0080ff' });
		console.log('Result:', result2 ? 'Success' : 'Failed');

		console.log('Adding +1d4 fire to weapon-main.damage...');
		const result3 = addModifier(actor.name, 'weapon-main.damage', 'Fire Damage', '1d4', { color: '#ff4000' });
		console.log('Result:', result3 ? 'Success' : 'Failed');

		console.log('\n--- Current Modifiers ---');
		const modifiers = listModifiers(actor.name);
		console.log('All modifiers:', JSON.stringify(modifiers, null, 2));

		console.log('\n--- Testing Remove Modifier ---');
		console.log('Removing blessing from strength...');
		const removeResult = removeModifier(actor.name, 'strength', 'Blessing');
		console.log('Result:', removeResult ? 'Success' : 'Failed');

		console.log('\n--- Modifiers After Removal ---');
		const modifiersAfter = listModifiers(actor.name);
		console.log('Remaining modifiers:', JSON.stringify(modifiersAfter, null, 2));

		console.log('\n=== Test completed! Check the character sheet to see changes ===');
		ui.notifications.info('ModifierManager test completed. Check console for detailed output.');
	};

	window.analyzeArmorDuplicates = function () {
		const selectedTokens = canvas.tokens.controlled;
		if (selectedTokens.length === 0) {
			ui.notifications.warn('Please select a token first');
			return;
		}

		const actor = selectedTokens[0].actor;
		const analysis = ArmorCleanup.analyzeActor(actor);
		console.log('=== Armor Duplicate Analysis ===');
		console.log(JSON.stringify(analysis, null, 2));
		ui.notifications.info(`Found ${analysis.totalDuplicates} duplicate armor modifiers on ${actor.name}`);
	};

	window.cleanupArmorDuplicates = async function () {
		const selectedTokens = canvas.tokens.controlled;
		if (selectedTokens.length === 0) {
			ui.notifications.warn('Please select a token first');
			return;
		}

		const actor = selectedTokens[0].actor;
		const result = await ArmorCleanup.cleanupActor(actor);
		console.log('=== Armor Cleanup Results ===');
		console.log(JSON.stringify(result, null, 2));

		if (result.success) {
			ui.notifications.info(`Cleaned up ${result.modifiersRemoved} duplicate modifiers from ${actor.name}`);
		} else {
			ui.notifications.error(`Cleanup failed: ${result.errors.join(', ')}`);
		}
	};

	window.cleanupAllArmorDuplicates = async function () {
		if (!game.user.isGM) {
			ui.notifications.error('Only GMs can run global cleanup');
			return;
		}

		const result = await ArmorCleanup.cleanupAllActors();
		console.log('=== Global Armor Cleanup Results ===');
		console.log(JSON.stringify(result, null, 2));

		if (result.success) {
			ui.notifications.info(
				`Processed ${result.processedActors} actors, removed ${result.totalModifiersRemoved} duplicate modifiers`
			);
		} else {
			ui.notifications.error(`Global cleanup had errors: ${result.errors.join(', ')}`);
		}
	};

	game.daggerheart.testModifierSystem = window.testModifierSystem;

	console.log('Counter UI initialized and displayed above the hotbar.');
	console.log(
		'spendFear(), gainFear(), spendStress(), clearStress(), spendHope(), gainHope(), applyDamage(), applyHealing(), rollDamage(), rollDamageWithDialog(), rollHealing(), undoDamageHealing(), debugUndoData(), cleanupDuplicateMacros(), testWeaponEquip(), testModifierSystem(), and testFearAutomation() functions are now available globally.'
	);
	console.log(
		'🎯 Modifier System: addModifier(), removeModifier(), and listModifiers() functions are now available globally.'
	);
	console.log('� Global Hope/Fear automation is now active for ALL duality rolls!');

	game.daggerheart.testFearAutomation = window.testFearAutomation;

	if (game.user.isGM) {
		await _cleanupDuplicateMacros();
	}

	game.socket.on('system.daggerheart-unofficial', async data => {
		if (!game.user.isGM) return;

		if (data.type === 'requestFearGain') {
			console.log(
				`Daggerheart | Processing fear gain request from ${data.userName}: +${data.amount} from ${data.source}`
			);

			if (game.daggerheart?.counter) {
				try {
					await game.daggerheart.counter.gainFear(data.amount);

					game.socket.emit('system.daggerheart-unofficial', {
						type: 'fearGainConfirmation',
						amount: data.amount,
						source: data.source,
						success: true,
						targetUserId: data.userId,
					});
				} catch (error) {
					console.error('Daggerheart | Error processing fear gain request:', error);

					game.socket.emit('system.daggerheart-unofficial', {
						type: 'fearGainConfirmation',
						amount: data.amount,
						source: data.source,
						success: false,
						error: error.message,
						targetUserId: data.userId,
					});
				}
			}
		}

		if (data.type === 'fearGainConfirmation' && data.targetUserId === game.user.id) {
			if (data.success) {
				console.log(`Daggerheart | Fear gain confirmed: +${data.amount} from ${data.source}`);
			} else {
				console.warn(`Daggerheart | Fear gain failed: ${data.error}`);
			}
		}
	});

	game.socket.on('system.daggerheart-unofficial', data => {
		if (data.type === 'fearChanged' && data.userId !== game.user.id) {
			console.log(`Daggerheart | Received fear change event from user ${data.userId}`);
			if (game.daggerheart?.counter) {
				game.daggerheart.counter.triggerFearChangeAnimation();
			} else {
				console.warn('Daggerheart | Counter not available for fear change animation');
			}
		}
	});

	console.log('Daggerheart | System ready with dynamic weapon resolution');
});

async function _cleanupDuplicateMacros() {
	const macroConfigs = [
		{ name: 'Apply Damage', flag: 'daggerheart.damageApplicationMacro' },
		{ name: 'Apply Healing', flag: 'daggerheart.healingApplicationMacro' },
		{ name: 'Roll Damage', flag: 'daggerheart.rollDamageMacro' },
		{ name: 'Roll Healing', flag: 'daggerheart.rollHealingMacro' },
		{ name: 'Spend Fear', flag: 'daggerheart.spendFearMacro' },
		{ name: 'Spend 1 Fear', flag: 'daggerheart.spendFearMacro' },
		{ name: 'Gain Fear', flag: 'daggerheart.gainFearMacro' },
		{ name: 'Apply Stress', flag: 'daggerheart.spendStressMacro' },
		{ name: 'Clear Stress', flag: 'daggerheart.clearStressMacro' },
		{ name: 'Clear 1 Stress', flag: 'daggerheart.clearStressMacro' },
		{ name: 'Spend Hope', flag: 'daggerheart.spendHopeMacro' },
		{ name: 'Spend 1 Hope', flag: 'daggerheart.spendHopeMacro' },
		{ name: 'Gain Hope', flag: 'daggerheart.gainHopeMacro' },
		{ name: 'Gain 1 Hope', flag: 'daggerheart.gainHopeMacro' },
	];

	let totalCleaned = 0;

	for (const config of macroConfigs) {
		const duplicates = game.macros.filter(m => m.name === config.name);

		if (duplicates.length > 1) {
			console.log(`Found ${duplicates.length} duplicate macros named "${config.name}", cleaning up...`);

			let macroToKeep =
				duplicates.find(m => m.flags?.[config.flag.split('.')[0]]?.[config.flag.split('.')[1]]) || duplicates[0];

			const macrosToDelete = duplicates.filter(m => m.id !== macroToKeep.id);
			for (const macro of macrosToDelete) {
				await macro.delete();
				console.log(`Deleted duplicate macro: ${config.name} (${macro.id})`);
				totalCleaned++;
			}

			if (!macroToKeep.flags?.[config.flag.split('.')[0]]?.[config.flag.split('.')[1]]) {
				const flagParts = config.flag.split('.');
				await macroToKeep.setFlag(flagParts[0], flagParts[1], true);
			}
		}
	}

	if (totalCleaned > 0) {
		ui.notifications.info(`Cleaned up ${totalCleaned} duplicate macros.`);
		console.log(`Daggerheart | Cleaned up ${totalCleaned} duplicate macros.`);
	} else {
		console.log('Daggerheart | No duplicate macros found to clean up.');
	}
}

Hooks.on('getSceneControlButtons', controls => {
	console.log('🎯 DAGGERHEART: getSceneControlButtons hook triggered!');
	console.log('🎯 DAGGERHEART: Controls received:', controls);
	console.log('🎯 DAGGERHEART: Controls type:', typeof controls);
	console.log('🎯 DAGGERHEART: Controls keys:', Object.keys(controls));

	const canManage = game.user.isGM || game.user.hasRole('ASSISTANT');
	if (!canManage) {
		console.log("🎯 DAGGERHEART: User doesn't have permission to manage countdown trackers");
		return;
	}

	if (controls.tokens) {
		console.log('🎯 DAGGERHEART: Found tokens controls:', controls.tokens);
		console.log('🎯 DAGGERHEART: Tokens controls tools:', controls.tokens.tools);
		console.log('🎯 DAGGERHEART: Tokens controls tools type:', typeof controls.tokens.tools);
		console.log('🎯 DAGGERHEART: Tokens controls tools is array:', Array.isArray(controls.tokens.tools));

		if (!controls.tokens.tools) {
			controls.tokens.tools = {};
			console.log('🎯 DAGGERHEART: Created tools object for tokens controls');
		}

		console.log('🎯 DAGGERHEART: Adding countdown tracker button to tokens controls');
		controls.tokens.tools['countdown-tracker-manage'] = {
			name: 'countdown-tracker-manage',
			title: 'Manage Countdown Trackers',
			icon: 'fas fa-stopwatch',
			button: true,
			onClick: async () => {
				console.log('🎯 DAGGERHEART: Countdown tracker button clicked!');
				if (game.daggerheart?.countdownTracker) {
					await game.daggerheart.countdownTracker.showManagementDialog();
				} else {
					ui.notifications.error('Countdown tracker not initialized');
				}
			},
		};

		console.log('🎯 DAGGERHEART: Button added successfully to tokens controls');
	} else {
		console.log('🎯 DAGGERHEART: Tokens controls not found');
		console.log('🎯 DAGGERHEART: Available control groups:', Object.keys(controls));

		const firstControlKey = Object.keys(controls)[0];
		if (firstControlKey && controls[firstControlKey]) {
			console.log(`🎯 DAGGERHEART: Trying to add to first available control group: ${firstControlKey}`);
			console.log(`🎯 DAGGERHEART: Control structure:`, controls[firstControlKey]);

			if (!controls[firstControlKey].tools) {
				console.log(`🎯 DAGGERHEART: Creating tools object for ${firstControlKey}`);
				controls[firstControlKey].tools = {};
			}

			console.log(`🎯 DAGGERHEART: Adding button to ${firstControlKey} controls`);
			controls[firstControlKey].tools['countdown-tracker-manage'] = {
				name: 'countdown-tracker-manage',
				title: 'Manage Countdown Trackers',
				icon: 'fas fa-stopwatch',
				button: true,
				onClick: async () => {
					console.log('🎯 DAGGERHEART: Countdown tracker button clicked (fallback)!');
					if (game.daggerheart?.countdownTracker) {
						await game.daggerheart.countdownTracker.showManagementDialog();
					} else {
						ui.notifications.error('Countdown tracker not initialized');
					}
				},
			};

			console.log(`🎯 DAGGERHEART: Button added to fallback control group: ${firstControlKey}`);
		}
	}
});

Hooks.on('preCreateActor', function (document, data, options, userId) {
	const type = data.type || document.type;
	const isCompanion = type === 'companion';
	const primaryAttr = isCompanion ? 'stressBar' : 'healthBar';
	const secondaryAttr = isCompanion ? 'healthBar' : 'stressBar';

	document.updateSource({
		prototypeToken: foundry.utils.mergeObject(document.prototypeToken?.toObject() || {}, {
			actorLink: type === 'character' || type === 'companion',
			bar1: { attribute: primaryAttr },
			bar2: { attribute: secondaryAttr },
		}),
	});
});

Hooks.on('renderChatLog', (app, html, data) => {
	const chatControls = $(document).find('.chat-controls');

	const horizontalRollPrivacy = chatControls.find('#roll-privacy.split-button:not(.vertical)');

	if (horizontalRollPrivacy.length) {
		if (!horizontalRollPrivacy.find('[data-action="roll-duality"]').length) {
			const horizontalDualityButton = $(`
        <button type="button" class="ui-control icon fa-solid fa-dice"
                data-action="roll-duality"
                data-roll-mode="duality"
                aria-pressed="false"
                data-tooltip="Roll Duality Dice"
                aria-label="Roll Duality Dice">
        </button>
      `);

			horizontalDualityButton.on('click', async event => {
				event.preventDefault();

				await game.daggerheart.rollHandler.dualityWithDialog({
					title: 'Duality Dice Roll',
				});
			});

			horizontalRollPrivacy.append(horizontalDualityButton);
		}
	}

	const verticalRollPrivacy = $(document).find('#roll-privacy.split-button.vertical');

	if (verticalRollPrivacy.length) {
		if (!verticalRollPrivacy.find('[data-action="roll-duality"]').length) {
			const verticalDualityButton = $(`
        <button type="button" class="ui-control icon fa-solid fa-dice"
                data-action="roll-duality"
                data-roll-mode="duality"
                aria-pressed="false"
                data-tooltip="Roll Duality Dice"
                aria-label="Roll Duality Dice">
        </button>
      `);

			verticalDualityButton.on('click', async event => {
				event.preventDefault();

				await game.daggerheart.rollHandler.dualityWithDialog({
					title: 'Duality Dice Roll',
				});
			});

			verticalRollPrivacy.append(verticalDualityButton);
		}
	}

	if (!horizontalRollPrivacy.length && !verticalRollPrivacy.length) {
		setTimeout(() => {
			const delayedChatControls = $(document).find('.chat-controls');
			const delayedHorizontalRollPrivacy = delayedChatControls.find('#roll-privacy.split-button:not(.vertical)');
			const delayedVerticalRollPrivacy = $(document).find('#roll-privacy.split-button.vertical');

			if (
				delayedHorizontalRollPrivacy.length &&
				!delayedHorizontalRollPrivacy.find('[data-action="roll-duality"]').length
			) {
				const horizontalDualityButton = $(`
          <button type="button" class="ui-control icon fa-solid fa-dice"
                  data-action="roll-duality"
                  data-roll-mode="duality"
                  aria-pressed="false"
                  data-tooltip="Roll Duality Dice"
                  aria-label="Roll Duality Dice">
          </button>
        `);

				horizontalDualityButton.on('click', async event => {
					event.preventDefault();
					await game.daggerheart.rollHandler.dualityWithDialog({
						title: 'Duality Dice Roll',
					});
				});

				delayedHorizontalRollPrivacy.append(horizontalDualityButton);
			}

			if (
				delayedVerticalRollPrivacy.length &&
				!delayedVerticalRollPrivacy.find('[data-action="roll-duality"]').length
			) {
				const verticalDualityButton = $(`
          <button type="button" class="ui-control icon fa-solid fa-dice"
                  data-action="roll-duality"
                  data-roll-mode="duality"
                  aria-pressed="false"
                  data-tooltip="Roll Duality Dice"
                  aria-label="Roll Duality Dice">
          </button>
        `);

				verticalDualityButton.on('click', async event => {
					event.preventDefault();
					await game.daggerheart.rollHandler.dualityWithDialog({
						title: 'Duality Dice Roll',
					});
				});

				delayedVerticalRollPrivacy.append(verticalDualityButton);
			}
		}, 100);
	}
});

Hooks.on('renderChatMessage', (message, html, data) => {
	const flags = message.flags?.['daggerheart-unofficial'];
	if (!flags) return;

	const rollType = flags.rollType;
	const actorId = flags.actorId;
	const actorType = flags.actorType;
	const weaponName = flags.weaponName;

	if (rollType === 'attack') {
		const existingButton = html.find('.damage-roll-button').length;
		if (existingButton > 0) return;

		const actor = game.actors.get(actorId);
		if (!actor) return;

		let weaponData = null;
		let weaponType = null;

		const primaryWeapon = actor.system['weapon-main'];
		const secondaryWeapon = actor.system['weapon-off'];

		if (primaryWeapon?.name === weaponName) {
			weaponData = primaryWeapon;
			weaponType = 'primary';
		} else if (secondaryWeapon?.name === weaponName) {
			weaponData = secondaryWeapon;
			weaponType = 'secondary';
		}

		if (!weaponData || !weaponData.damage) return;

		const flavor = message.flavor || '';
		const isCritical = flavor.includes('Critical') && flavor.includes('Success');

		if (actorType === 'character') {
			_addCharacterDamageButton(html, actor, weaponData, weaponType, isCritical);
		} else if (actorType === 'npc' || actorType === 'companion') {
			_addAdversaryDamageButton(html, actor, weaponData, weaponType, isCritical);
		}
	}

	if (rollType === 'damage') {
		_addDamageApplicationButtons(message, html, flags);
	}

	if (rollType === 'healing') {
		_addHealingApplicationButtons(message, html, flags);
	}

	if (
		flags.messageType === 'damageApplied' ||
		flags.messageType === 'healingApplied' ||
		flags.messageType === 'directDamageApplied'
	) {
		_addUndoButtonHandlers(html, flags);
	}
});

function _addCharacterDamageButton(html, actor, weaponData, weaponType, isCritical) {
	const buttonText = isCritical ? 'Critical Damage' : 'Damage';

	let damageDataJson;
	if (typeof weaponData.damage === 'object' && weaponData.damage !== null && 'baseValue' in weaponData.damage) {
		damageDataJson = JSON.stringify(weaponData.damage);
	} else {
		const simpleFormula = weaponData.damage || '1d8';
		damageDataJson = JSON.stringify({
			baseValue: simpleFormula,
			modifiers: [],
			value: simpleFormula,
		});
	}

	const damageButton = `<button class="damage-roll-button character ${isCritical ? 'critical' : ''}" data-actor-id="${actor.id}" data-weapon-type="${weaponType}" data-weapon-name="${weaponData.name}" data-weapon-damage-structure="${damageDataJson}" data-is-critical="${isCritical}" style="margin-top: 0.5em; width: 100%;">
    <i class="fas fa-dice-d20"></i> ${buttonText}
  </button>`;

	html.find('.message-content').append(damageButton);

	html.find('.damage-roll-button.character').click(async event => {
		event.preventDefault();
		await _rollCharacterDamage(event);
	});
}

function _addAdversaryDamageButton(html, actor, weaponData, weaponType, isCritical) {
	const buttonText = isCritical ? 'Critical Damage' : 'Damage';

	let damageDataJson;
	if (typeof weaponData.damage === 'object' && weaponData.damage !== null && 'baseValue' in weaponData.damage) {
		damageDataJson = JSON.stringify(weaponData.damage);
	} else {
		const simpleFormula = weaponData.damage || '1d8';
		damageDataJson = JSON.stringify({
			baseValue: simpleFormula,
			modifiers: [],
			value: simpleFormula,
		});
	}

	const damageButton = `<button class="damage-roll-button adversary ${isCritical ? 'critical' : ''}" data-actor-id="${actor.id}" data-weapon-type="${weaponType}" data-weapon-name="${weaponData.name}" data-weapon-damage-structure="${damageDataJson}" data-is-critical="${isCritical}" style="margin-top: 0.5em; width: 100%;">
    <i class="fas fa-dice-d20"></i> ${buttonText}
  </button>`;

	html.find('.message-content').append(damageButton);

	html.find('.damage-roll-button.adversary').click(async event => {
		event.preventDefault();
		await _rollAdversaryDamage(event);
	});
}

function _handleCharacterDamageButton(message, html, actor, flavor) {
	let weaponData = null;
	let weaponType = null;

	const primaryWeapon = actor.system['weapon-main'];
	const secondaryWeapon = actor.system['weapon-off'];

	if (primaryWeapon?.name && flavor.includes(primaryWeapon.name)) {
		weaponData = primaryWeapon;
		weaponType = 'primary';
	} else if (secondaryWeapon?.name && flavor.includes(secondaryWeapon.name)) {
		weaponData = secondaryWeapon;
		weaponType = 'secondary';
	}

	const existingButton = html.find('.damage-roll-button').length;

	if (weaponData && weaponData.damage && !existingButton) {
		const isDamageRoll =
			flavor.includes('Damage') ||
			flavor.includes('damage') ||
			flavor.toLowerCase().includes('- damage') ||
			flavor.includes('Critical Damage') ||
			flavor.includes('critical damage');

		const hasHopeFear = flavor.includes('Hope') || flavor.includes('Fear');

		if (hasHopeFear && !isDamageRoll) {
			const isCritical = flavor.includes('Critical') && flavor.includes('Success');

			let damageDataJson;
			if (typeof weaponData.damage === 'object' && weaponData.damage !== null && 'baseValue' in weaponData.damage) {
				damageDataJson = JSON.stringify(weaponData.damage);
			} else {
				const simpleFormula = weaponData.damage || '1d8';
				damageDataJson = JSON.stringify({
					baseValue: simpleFormula,
					modifiers: [],
					value: simpleFormula,
				});
			}

			const buttonText = isCritical ? 'Critical Damage' : 'Damage';
			const damageButton = `<button class="damage-roll-button character ${isCritical ? 'critical' : ''}" data-actor-id="${actor.id}" data-weapon-type="${weaponType}" data-weapon-name="${weaponData.name}" data-weapon-damage-structure="${damageDataJson}" data-is-critical="${isCritical}" style="margin-top: 0.5em; width: 100%;">
        <i class="fas fa-dice-d20"></i> ${buttonText}
      </button>`;

			const messageContent = html.find('.message-content');
			messageContent.append(damageButton);

			html.find('.damage-roll-button.character').click(async event => {
				event.preventDefault();
				await _rollCharacterDamage(event);
			});
		}
	}
}

function _handleAdversaryDamageButton(message, html, actor, flavor) {
	let weaponData = null;
	let weaponType = null;

	const primaryAttack = actor.system['weapon-main'];
	const secondaryAttack = actor.system['weapon-off'];

	if (primaryAttack?.name && flavor.includes(primaryAttack.name)) {
		weaponData = primaryAttack;
		weaponType = 'primary';
	} else if (secondaryAttack?.name && flavor.includes(secondaryAttack.name)) {
		weaponData = secondaryAttack;
		weaponType = 'secondary';
	}

	const existingButton = html.find('.damage-roll-button').length;

	if (weaponData && weaponData.damage && !existingButton) {
		const isDamageRoll =
			flavor.includes('Damage') ||
			flavor.includes('damage') ||
			flavor.toLowerCase().includes('- damage') ||
			flavor.includes('Critical Damage') ||
			flavor.includes('critical damage');

		const isAttackRoll = flavor.includes(weaponData.name) && !isDamageRoll;

		if (isAttackRoll) {
			const isCritical = flavor.includes('Critical Success');

			let damageDataJson;
			if (typeof weaponData.damage === 'object' && weaponData.damage !== null && 'baseValue' in weaponData.damage) {
				damageDataJson = JSON.stringify(weaponData.damage);
			} else {
				const simpleFormula = weaponData.damage || '1d8';
				damageDataJson = JSON.stringify({
					baseValue: simpleFormula,
					modifiers: [],
					value: simpleFormula,
				});
			}

			const buttonText = isCritical ? 'Critical Damage' : 'Damage';
			const damageButton = `<button class="damage-roll-button adversary ${isCritical ? 'critical' : ''}" data-actor-id="${actor.id}" data-weapon-type="${weaponType}" data-weapon-name="${weaponData.name}" data-weapon-damage-structure="${damageDataJson}" data-is-critical="${isCritical}" style="margin-top: 0.5em; width: 100%;">
        <i class="fas fa-dice-d20"></i> ${buttonText}
      </button>`;

			const messageContent = html.find('.message-content');
			messageContent.append(damageButton);

			html.find('.damage-roll-button.adversary').click(async event => {
				event.preventDefault();
				await _rollAdversaryDamage(event);
			});
		}
	}
}

async function _rollConsolidatedDamage(event) {
	console.log('Daggerheart | _rollConsolidatedDamage called with event:', event);

	const button = event.currentTarget;
	const actorId = button.dataset.actorId;
	const weaponType = button.dataset.weaponType;
	const weaponName = button.dataset.weaponName;
	const damageStructureJson = button.dataset.weaponDamageStructure;
	const isCritical = button.dataset.isCritical === 'true';

	console.log('Daggerheart | Damage roll data:', {
		actorId,
		weaponType,
		weaponName,
		damageStructureJson,
		isCritical,
	});

	const actor = game.actors.get(actorId);
	if (!actor) {
		console.error('Daggerheart | Actor not found for consolidated damage roll');
		return;
	}

	let damageData;
	try {
		damageData = JSON.parse(damageStructureJson);
	} catch (error) {
		console.warn('Daggerheart | Invalid damage structure in button, fetching from actor');

		const weaponField = weaponType === 'primary' ? 'weapon-main' : 'weapon-off';
		const weaponData = actor.system[weaponField];

		if (weaponData && weaponData.damage) {
			if (typeof weaponData.damage === 'object' && weaponData.damage !== null && 'baseValue' in weaponData.damage) {
				damageData = weaponData.damage;
			} else {
				damageData = {
					baseValue: weaponData.damage || '1d8',
					modifiers: [],
					value: weaponData.damage || '1d8',
				};
			}
		} else {
			damageData = {
				baseValue: '1d8',
				modifiers: [],
				value: '1d8',
			};
		}
	}

	const proficiency = actor.type === 'character' ? Math.max(1, parseInt(actor.system.proficiency?.value) || 1) : null;

	const flavorText = isCritical ? `${weaponName} - Critical Damage!` : `${weaponName} - Damage`;

	try {
		// Extract base formula from damage data
		let baseFormula = '1d8';
		if (damageData) {
			if (typeof damageData === 'string') {
				baseFormula = damageData;
			} else if (damageData.baseValue) {
				baseFormula = damageData.baseValue;
			} else if (damageData.value) {
				baseFormula = damageData.value;
			}
		}

		// Determine weapon slot for modifier filtering
		const weaponSlot = weaponType === 'primary' ? 'weapon-main' : 'weapon-off';

		// Use the damage dialog for interactive damage rolling
		await game.daggerheart.damageApplication.rollDamageWithDialog(baseFormula, {
			sourceActor: actor,
			weaponName: weaponName,
			weaponType: weaponType,
			weaponSlot: weaponSlot,
			isCritical: isCritical,
			damageModifiers: damageData?.modifiers || [],
		});
	} catch (error) {
		console.error('Error creating consolidated damage roll:', error);
		ui.notifications.warn('Damage roll failed. Check console for details.');
	}
}

async function _rollCharacterDamage(event) {
	return await _rollConsolidatedDamage(event);
}

async function _rollAdversaryDamage(event) {
	return await _rollConsolidatedDamage(event);
}

function _updateArmorSlotsValue(html, delta) {
	const armorSlotsContainer = html.find('.armor-slots-ui');
	const currentElement = html.find('.armor-slots-current');
	const maxElement = html.find('.armor-slots-max');

	if (!armorSlotsContainer.length || !currentElement.length || !maxElement.length) {
		console.warn('Armor slots elements not found');
		return;
	}

	let current = parseInt(currentElement.text()) || 0;
	const max = parseInt(maxElement.text()) || 3;

	const newValue = Math.max(0, Math.min(max, current + delta));

	if (newValue !== current) {
		currentElement.text(newValue);

		armorSlotsContainer.data('current', newValue);
		armorSlotsContainer.data('max', max);

		console.log(`Armor slots: ${current} → ${newValue}`);
	}
}

function _getArmorSlotsUI(currentSlots = 0, maxSlots = 3, showUI = true) {
	if (!showUI) return '';

	return `<div class="armor-slots-ui resource armor-slots" style="margin: 0.75em 0 0.5em 0;">
    <div class="resource-content">
      <div class="resource-box">
        <span class="armor-slots-current">${currentSlots}</span>
        <span>/</span>
        <span class="armor-slots-max">${maxSlots}</span>
      </div>
    </div>
    <div class="resource-label-controls">
      <a class="resource-control armor-slots-decrement" data-action="decrement" title="Decrease Armor Slots Used">
        <i class="fas fa-minus"></i>
      </a>
      <label>Use Armor Slots</label>
      <a class="resource-control armor-slots-increment" data-action="increment" title="Increase Armor Slots Used">
        <i class="fas fa-plus"></i>
      </a>
    </div>
  </div>`;
}

function _getTargetArmorInfo() {
	const targets = Array.from(game.user.targets);
	if (targets.length === 0) return { showUI: false, maxSlots: 0 };
	const characterTarget = targets.find(t => t.actor?.type === 'character');
	if (!characterTarget) return { showUI: false, maxSlots: 0 };
	const maxSlots = parseInt(characterTarget.actor.system.defenses?.['armor-slots']?.max) || 3;
	return { showUI: true, maxSlots };
}

function _initializeArmorSlotsHandlers(html, initialValue = 0, maxValue = 3) {
	const armorSlotsContainer = html.find('.armor-slots-ui');
	if (!armorSlotsContainer.length) return;

	armorSlotsContainer.data('current', initialValue);
	armorSlotsContainer.data('max', maxValue);

	html.find('.armor-slots-increment').click(async event => {
		event.preventDefault();
		_updateArmorSlotsValue(html, 1);
	});

	html.find('.armor-slots-decrement').click(async event => {
		event.preventDefault();
		_updateArmorSlotsValue(html, -1);
	});
}

function _addDamageApplicationButtons(message, html, flags) {
	const existingButtons = html.find('.apply-damage-button, .apply-healing-button').length;
	if (existingButtons > 0) return;

	const damageAmount = flags.damageAmount || extractRollTotal(message);
	if (!damageAmount) return;

	const sourceActor = game.actors.get(flags.actorId);

	const targetActorIds = flags.targetActorIds || null;
	const armorSlotsUI = _getMultiTargetArmorSlotsUI(targetActorIds);

	const buttonContainer = `${armorSlotsUI}<div class="damage-application-buttons" style="margin-top: 0.5em; display: flex; gap: 0.25em;">
    <button class="apply-damage-button" data-damage="${damageAmount}" data-source-actor-id="${flags.actorId || ''}" style="flex: 1;">
      <i class="fas fa-sword"></i> Damage (${damageAmount})
    </button>
    <button class="apply-healing-button" data-healing="${damageAmount}" data-source-actor-id="${flags.actorId || ''}" style="flex: 1;">
      <i class="fas fa-heart"></i> Heal (${damageAmount})
    </button>
  </div>`;

	html.find('.message-content').append(buttonContainer);

	if (armorSlotsUI) {
		_initializeMultiTargetArmorSlotsHandlers(html);
	}

	html.find('.apply-damage-button').click(async event => {
		event.preventDefault();
		await _handleDamageApplicationButton(event, 'damage');
	});

	html.find('.apply-healing-button').click(async event => {
		event.preventDefault();
		await _handleDamageApplicationButton(event, 'healing');
	});
}

function _addHealingApplicationButtons(message, html, flags) {
	const existingButtons = html.find('.apply-damage-button, .apply-healing-button').length;
	if (existingButtons > 0) return;

	const healingAmount = flags.healingAmount || extractRollTotal(message);
	if (!healingAmount) return;

	const sourceActor = game.actors.get(flags.actorId);

	const targetActorIds = flags.targetActorIds || null;
	const armorSlotsUI = _getMultiTargetArmorSlotsUI(targetActorIds);

	const buttonContainer = `${armorSlotsUI}<div class="damage-application-buttons" style="margin-top: 0.5em; display: flex; gap: 0.25em;">
    <button class="apply-healing-button" data-healing="${healingAmount}" data-source-actor-id="${flags.actorId || ''}" style="flex: 1;">
      <i class="fas fa-heart"></i> Heal (${healingAmount})
    </button>
    <button class="apply-damage-button" data-damage="${healingAmount}" data-source-actor-id="${flags.actorId || ''}" style="flex: 1;">
      <i class="fas fa-sword"></i> Damage (${healingAmount})
    </button>
  </div>`;

	html.find('.message-content').append(buttonContainer);

	if (armorSlotsUI) {
		_initializeMultiTargetArmorSlotsHandlers(html);
	}

	html.find('.apply-healing-button').click(async event => {
		event.preventDefault();
		await _handleDamageApplicationButton(event, 'healing');
	});

	html.find('.apply-damage-button').click(async event => {
		event.preventDefault();
		await _handleDamageApplicationButton(event, 'damage');
	});
}

async function _handleDamageApplicationButton(event, type) {
	const button = event.currentTarget;
	const amount = parseInt(button.dataset[type]) || 0;
	const sourceActorId = button.dataset.sourceActorId;

	if (amount <= 0) {
		ui.notifications.error('Invalid amount for application.');
		return;
	}

	const sourceActor = sourceActorId ? game.actors.get(sourceActorId) : null;

	let armorSlotsUsed = 0;
	if (type === 'damage') {
		const messageElement = $(button).closest('.chat-message');
		const armorSlotsData = _collectMultiTargetArmorSlots(messageElement);

		if (Object.keys(armorSlotsData).length > 0) {
			armorSlotsUsed = armorSlotsData;
			console.log(`Daggerheart | Using per-target armor slots:`, armorSlotsData);
		} else {
			const armorSlotsContainer = messageElement.find('.armor-slots-ui');
			if (armorSlotsContainer.length) {
				armorSlotsUsed = parseInt(armorSlotsContainer.data('current')) || 0;
				console.log(`Daggerheart | Using single armor slots value: ${armorSlotsUsed} for all targets`);
			}
		}
	}

	try {
		let result = { success: false, undoId: null };
		if (type === 'damage') {
			result = await applyDamage(null, amount, sourceActor, true, armorSlotsUsed);
		} else if (type === 'healing') {
			result = await applyHealing(null, amount, sourceActor);
		}

		if (!result.success) {
			console.warn(`Failed to apply ${type}`);
		}
	} catch (error) {
		console.error(`Error applying ${type}:`, error);
		ui.notifications.error(`Error applying ${type}. Check console for details.`);
	}
}

Hooks.on('preCreateChatMessage', (message, data, options, userId) => {});

Hooks.on('getActorDirectoryEntryContext', (html, options) => {
	options.push({
		name: game.i18n.localize('SIMPLE.DefineTemplate'),
		icon: '<i class="fas fa-stamp"></i>',
		condition: li => {
			const actor = game.actors.get(li.data('documentId'));
			return !actor.isTemplate;
		},
		callback: li => {
			const actor = game.actors.get(li.data('documentId'));
			actor.setFlag('daggerheart-unofficial', 'isTemplate', true);
		},
	});

	options.push({
		name: game.i18n.localize('SIMPLE.UnsetTemplate'),
		icon: '<i class="fas fa-times"></i>',
		condition: li => {
			const actor = game.actors.get(li.data('documentId'));
			return actor.isTemplate;
		},
		callback: li => {
			const actor = game.actors.get(li.data('documentId'));
			actor.setFlag('daggerheart-unofficial', 'isTemplate', false);
		},
	});
});

Hooks.on('getItemDirectoryEntryContext', (html, options) => {
	options.push({
		name: game.i18n.localize('SIMPLE.DefineTemplate'),
		icon: '<i class="fas fa-stamp"></i>',
		condition: li => {
			const item = game.items.get(li.data('documentId'));
			return !item.isTemplate;
		},
		callback: li => {
			const item = game.items.get(li.data('documentId'));
			item.setFlag('daggerheart-unofficial', 'isTemplate', true);
		},
	});

	options.push({
		name: game.i18n.localize('SIMPLE.UnsetTemplate'),
		icon: '<i class="fas fa-times"></i>',
		condition: li => {
			const item = game.items.get(li.data('documentId'));
			return item.isTemplate;
		},
		callback: li => {
			const item = game.items.get(li.data('documentId'));
			item.setFlag('daggerheart-unofficial', 'isTemplate', false);
		},
	});
});

Hooks.on('getItemContextOptions', (application, buttons) => {
	const CompatibleTypes = ['Item'];
	const documentName = application.documentName;
	if (!CompatibleTypes.includes(documentName)) return;

	buttons.push({
		name: 'To Chat',
		icon: '<i class="fa-solid fa-comment-alt"></i>',
		callback: async li => {
			const entryId = li.dataset['entryId'];
			const entryPack =
				application.collection?.applicationClass?.name === 'Compendium' ? application.collection : undefined;

			if (entryPack) {
				const item = await entryPack.getDocument(entryId);
				await _sendItemToChat(item);
			} else {
				const item = application.collection.get(entryId);
				await _sendItemToChat(item);
			}

			return false;
		},
	});
});

Hooks.on('getItemSheetHeaderButtons', (sheet, buttons) => {
	buttons.unshift({
		label: 'To Chat',
		class: 'to-chat',
		icon: 'fas fa-comment-alt',
		onclick: async () => {
			if (!sheet.object) return;
			const item = sheet.object;
			await _sendItemToChat(item);
		},
	});
});

async function _sendItemToChat(item) {
	const actor =
		canvas.tokens.controlled[0]?.actor ??
		game.user?.character ??
		new Actor({
			name: game.user.name,
			type: 'character',
		});

	const chatCard = buildItemCardChat({
		itemId: item.id,
		actorId: actor.id,
		image: item.img,
		name: item.name,
		category: item.system.category || '',
		rarity: item.system.rarity || '',
		description: item.system.description || '',
		itemType: item.type,
		system: item.system,
	});

	ChatMessage.create({
		user: game.user.id,
		speaker: ChatMessage.getSpeaker({ actor }),
		content: chatCard,
	});
}

function _addUndoButtonHandlers(html, flags) {
	html.find('.undo-damage-button, .undo-healing-button').click(async event => {
		event.preventDefault();
		const button = event.currentTarget;
		const undoId = button.dataset.undoId;

		if (!undoId) {
			ui.notifications.error('Undo ID not found.');
			return;
		}

		try {
			button.disabled = true;
			button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Undoing...';

			const success = await undoDamageHealing(undoId);

			if (success) {
				button.innerHTML = '<i class="fas fa-check"></i> Undone';
				button.style.opacity = '0.6';
			} else {
				button.disabled = false;
				button.innerHTML = '<i class="fas fa-undo"></i> Undo';
			}
		} catch (error) {
			console.error('Error during undo:', error);
			ui.notifications.error('Error during undo. Check console for details.');

			button.disabled = false;
			button.innerHTML = '<i class="fas fa-undo"></i> Undo';
		}
	});
}

function _getMultiTargetArmorInfo(targetActorIds = null) {
	const characterTargets = [];

	const collectForActor = actor => {
		if (!actor || actor.type !== 'character') return;
		if (!game.user.isGM && !actor.isOwner) return;
		const maxSlots = parseInt(actor.system.defenses?.['armor-slots']?.max) || 0;
		const currentSlots = parseInt(actor.system.defenses?.['armor-slots']?.value) || 0;
		const availableSlots = Math.max(0, maxSlots - currentSlots);
		const usableSlots = Math.min(availableSlots, 3);
		characterTargets.push({
			actor,
			name: actor.name,
			id: actor.id,
			maxSlots,
			currentSlots,
			availableSlots,
			usableSlots,
		});
	};

	if (Array.isArray(targetActorIds) && targetActorIds.length > 0) {
		targetActorIds.forEach(id => collectForActor(game.actors.get(id)));
	} else {
		const targets = Array.from(game.user.targets || []);
		targets.forEach(token => collectForActor(token.actor));
	}

	return characterTargets;
}

function _getMultiTargetArmorSlotsUI(targetActorIds = null) {
	const characterTargets = _getMultiTargetArmorInfo(targetActorIds);

	if (characterTargets.length === 0) {
		return '';
	}

	let armorUIHtml = '<div class="multi-target-armor-container" style="margin: 0.75em 0 0.5em 0;">';

	if (characterTargets.length === 1) {
		const target = characterTargets[0];
		armorUIHtml += `
      <div class="armor-slots-ui resource armor-slots" data-actor-id="${target.id}">
        <div class="resource-content">
          <div class="resource-box">
            <span class="armor-slots-current">0</span>
            <span>/</span>
            <span class="armor-slots-max">${target.usableSlots}</span>
          </div>
        </div>
        <div class="resource-label-controls">
          <a class="resource-control armor-slots-decrement" data-action="decrement" title="Decrease Armor Slots Used">
            <i class="fas fa-minus"></i>
          </a>
          <label>
            <strong>${target.name}</strong> - Use Armor Slots
            <span class="armor-availability">(${target.availableSlots} available)</span>
          </label>
          <a class="resource-control armor-slots-increment" data-action="increment" title="Increase Armor Slots Used">
            <i class="fas fa-plus"></i>
          </a>
        </div>
      </div>`;
	} else {
		armorUIHtml += '<div class="multi-target-armor-header"><label>Armor Slots Per Character:</label></div>';

		characterTargets.forEach(target => {
			armorUIHtml += `
        <div class="armor-slots-ui resource armor-slots" data-actor-id="${target.id}" style="margin: 0.25em 0;">
          <div class="resource-content">
            <div class="resource-box">
              <span class="armor-slots-current">0</span>
              <span>/</span>
              <span class="armor-slots-max">${target.usableSlots}</span>
            </div>
          </div>
          <div class="resource-label-controls">
            <a class="resource-control armor-slots-decrement" data-action="decrement" title="Decrease Armor Slots Used for ${target.name}">
              <i class="fas fa-minus"></i>
            </a>
            <label>
              <strong>${target.name}</strong>
              <span class="armor-availability">(${target.availableSlots} available)</span>
            </label>
            <a class="resource-control armor-slots-increment" data-action="increment" title="Increase Armor Slots Used for ${target.name}">
              <i class="fas fa-plus"></i>
            </a>
          </div>
        </div>`;
		});
	}

	armorUIHtml += '</div>';
	return armorUIHtml;
}

function _initializeMultiTargetArmorSlotsHandlers(html) {
	const armorContainers = html.find('.armor-slots-ui');
	if (!armorContainers.length) return;

	armorContainers.each(function () {
		const container = $(this);
		const actorId = container.data('actor-id');
		const maxElement = container.find('.armor-slots-max');
		const maxValue = parseInt(maxElement.text()) || 3;

		container.data('current', 0);
		container.data('max', maxValue);
		container.data('actor-id', actorId);
	});

	html.find('.armor-slots-increment').click(async event => {
		event.preventDefault();
		const container = $(event.currentTarget).closest('.armor-slots-ui');
		_updateMultiTargetArmorSlotsValue(container, 1);
	});

	html.find('.armor-slots-decrement').click(async event => {
		event.preventDefault();
		const container = $(event.currentTarget).closest('.armor-slots-ui');
		_updateMultiTargetArmorSlotsValue(container, -1);
	});
}

function _updateMultiTargetArmorSlotsValue(container, delta) {
	const currentElement = container.find('.armor-slots-current');
	const maxElement = container.find('.armor-slots-max');

	if (!currentElement.length || !maxElement.length) {
		console.warn('Armor slots elements not found in container');
		return;
	}

	let current = parseInt(currentElement.text()) || 0;
	const max = parseInt(maxElement.text()) || 3;

	const newValue = Math.max(0, Math.min(max, current + delta));

	if (newValue !== current) {
		currentElement.text(newValue);

		container.data('current', newValue);
		container.data('max', max);

		const actorId = container.data('actor-id');
		console.log(`Armor slots for actor ${actorId}: ${current} → ${newValue}`);
	}
}

function _collectMultiTargetArmorSlots(html) {
	const armorSlots = {};
	const armorContainers = html.find('.armor-slots-ui');

	armorContainers.each(function () {
		const container = $(this);
		const actorId = container.data('actor-id');
		const current = parseInt(container.data('current')) || 0;

		if (actorId && current > 0) {
			armorSlots[actorId] = current;
		}
	});

	return armorSlots;
}
