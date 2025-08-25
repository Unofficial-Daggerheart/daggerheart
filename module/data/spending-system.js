// Import damage application functions
import { applyHealing, applyDirectDamage } from './damage-application.js';

/**
 * Create spendFear macro
 * @param {number} amount
 * @param {number} slot
 * @returns {Promise}
 */
export async function createSpendFearMacro(amount = 1, slot = null) {
	const command = `const amount = ${amount};
if (typeof spendFear === 'function') {
  await spendFear(amount);
} else {
  ui.notifications.error("spendFear function not available. Make sure the Daggerheart system is properly loaded.");
}`;

	const macroName = amount === 1 ? 'Spend Fear' : `Spend ${amount} Fear`;
	let macro =
		game.macros.find(m => m.name === macroName && m.flags?.['daggerheart.spendFearMacro']) ||
		game.macros.find(m => m.name === macroName && m.command === command);

	if (!macro) {
		macro = await Macro.create({
			name: macroName,
			type: 'script',
			img: 'icons/svg/skull.svg',
			command: command,
			flags: { 'daggerheart.spendFearMacro': true },
		});
	}

	if (slot !== null) {
		game.user.assignHotbarMacro(macro, slot);
	}

	return macro;
}

/**
 * Create gainFear macro
 * @param {number} amount
 * @param {number} slot
 * @returns {Promise}
 */
export async function createGainFearMacro(amount = 1, slot = null) {
	const command = `const amount = ${amount};
if (typeof gainFear === 'function') {
  await gainFear(amount);
} else {
  ui.notifications.error("gainFear function not available. Make sure the Daggerheart system is properly loaded.");
}`;

	const macroName = amount === 1 ? 'Gain Fear' : `Gain ${amount} Fear`;
	let macro =
		game.macros.find(m => m.name === macroName && m.flags?.['daggerheart.gainFearMacro']) ||
		game.macros.find(m => m.name === macroName && m.command === command);

	if (!macro) {
		macro = await Macro.create({
			name: macroName,
			type: 'script',
			img: 'icons/svg/terror.svg',
			command: command,
			flags: { 'daggerheart.gainFearMacro': true },
		});
	}

	if (slot !== null) {
		game.user.assignHotbarMacro(macro, slot);
	}

	return macro;
}

/**
 * Spend stress
 * @param {Actor|null} actor
 * @param {number} amount
 * @returns {Promise<boolean>}
 */
export async function spendStress(actor = null, amount = 1) {
	if (game.paused) {
		console.log('Daggerheart | Stress spending skipped - game is paused');
		ui.notifications.info('Stress spending skipped - game is paused');
		return false;
	}

	if (!Number.isInteger(amount) || amount <= 0) {
		console.error('Stress amount must be a positive integer');
		ui.notifications.error('Stress amount must be a positive integer.');
		return false;
	}

	let targetActor = actor;

	if (!targetActor) {
		const activeSheet = Object.values(ui.windows).find(app => app instanceof ActorSheet && app.rendered);

		if (activeSheet?.actor) {
			targetActor = activeSheet.actor;
			console.log(`Using actor from active sheet: ${targetActor.name}`);
		} else {
			const selectedTokens = canvas.tokens?.controlled || [];

			if (selectedTokens.length === 1) {
				targetActor = selectedTokens[0].actor;
				console.log(`Using actor from selected token: ${targetActor.name}`);
			} else if (selectedTokens.length > 1) {
				console.error('Multiple tokens selected. Please select only one token or specify an actor.');
				ui.notifications.error('Multiple tokens selected. Please select only one token.');
				return false;
			} else {
				console.error('No actor specified, no active character sheet, and no token selected.');
				ui.notifications.error('No target found. Please select a token, open a character sheet, or specify an actor.');
				return false;
			}
		}
	}

	if (!targetActor) {
		console.error('No valid actor found for stress spending');
		ui.notifications.error('No valid actor found.');
		return false;
	}

	if (!targetActor.system?.stress) {
		console.error(`Actor ${targetActor.name} does not have a stress system`);
		ui.notifications.error(`${targetActor.name} does not have a stress system.`);
		return false;
	}

	const canModify = game.user.isGM || game.user.hasRole('ASSISTANT') || targetActor.isOwner;

	if (!canModify) {
		console.warn(`User does not have permission to modify ${targetActor.name}'s stress`);
		ui.notifications.warn(`You do not have permission to modify ${targetActor.name}'s stress.`);
		return false;
	}

	const currentStress = parseInt(targetActor.system.stress.value) || 0;
	const maxStress = parseInt(targetActor.system.stress.max) || 6;
	const newStress = Math.min(maxStress, currentStress + amount);
	const actualAmount = newStress - currentStress;

	if (actualAmount <= 0) {
		console.warn(`${targetActor.name} already has maximum stress (${maxStress})`);
		ui.notifications.warn(`${targetActor.name} already has maximum stress.`);
		return false;
	}

	try {
		await targetActor.update({
			'system.stress.value': newStress,
		});

		const message =
			actualAmount === 1
				? `${targetActor.name} gains 1 stress. Current stress: ${newStress}/${maxStress}`
				: `${targetActor.name} gains ${actualAmount} stress. Current stress: ${newStress}/${maxStress}`;

		ui.notifications.info(message);

		ChatMessage.create({
			user: game.user.id,
			speaker: ChatMessage.getSpeaker({ actor: targetActor }),
			content: `<div class="stress-spend-message">
        <h3><i class="fas fa-exclamation-triangle"></i> Stress Applied</h3>
        <p><strong>${targetActor.name}</strong> gains <strong>${actualAmount}</strong> stress.</p>
        <p>Current stress: <strong>${newStress}/${maxStress}</strong></p>
        ${newStress >= maxStress ? '<p class="stress-warning"><em>Maximum stress reached!</em></p>' : ''}
      </div>`,
			flags: {
				'uo-msg': {
					messageType: 'stressApplied',
					actorId: targetActor.id,
					amountApplied: actualAmount,
					currentStress: newStress,
					maxStress: maxStress,
				},
			},
		});

		return true;
	} catch (error) {
		console.error('Error applying stress:', error);
		ui.notifications.error('Error applying stress. Check console for details.');
		return false;
	}
}

/**
 * Spend hope
 * @param {Actor|null} actor
 * @param {number} amount
 * @returns {Promise<boolean>}
 */
export async function spendHope(actor = null, amount = 1) {
	if (game.paused) {
		console.log('Daggerheart | Hope spending skipped - game is paused');
		ui.notifications.info('Hope spending skipped - game is paused');
		return false;
	}

	if (!Number.isInteger(amount) || amount <= 0) {
		console.error('Hope amount must be a positive integer');
		ui.notifications.error('Hope amount must be a positive integer.');
		return false;
	}

	let targetActor = actor;

	if (!targetActor) {
		console.log('Daggerheart | spendHope: No actor provided, attempting to find target actor');

		const activeSheet = Object.values(ui.windows).find(app => app instanceof ActorSheet && app.rendered);

		console.log('Daggerheart | spendHope: Active sheet found:', activeSheet ? activeSheet.constructor.name : 'none');
		console.log('Daggerheart | spendHope: Active sheet actor:', activeSheet?.actor?.name || 'none');

		if (activeSheet?.actor) {
			targetActor = activeSheet.actor;
			console.log(
				`Daggerheart | spendHope: Using actor from active sheet: ${targetActor.name} (type: ${targetActor.type})`
			);
		} else {
			const selectedTokens = canvas.tokens?.controlled || [];
			console.log('Daggerheart | spendHope: Selected tokens count:', selectedTokens.length);

			if (selectedTokens.length === 1) {
				targetActor = selectedTokens[0].actor;
				console.log(
					`Daggerheart | spendHope: Using actor from selected token: ${targetActor.name} (type: ${targetActor.type})`
				);
			} else if (selectedTokens.length > 1) {
				console.error('Multiple tokens selected. Please select only one token or specify an actor.');
				ui.notifications.error('Multiple tokens selected. Please select only one token.');
				return false;
			} else {
				console.error('No actor specified, no active character sheet, and no token selected.');
				ui.notifications.error('No target found. Please select a token, open a character sheet, or specify an actor.');
				return false;
			}
		}
	}

	if (!targetActor) {
		console.error('Daggerheart | spendHope: No valid actor found for hope spending');
		ui.notifications.error('No valid actor found.');
		return false;
	}

	console.log(
		'Daggerheart | spendHope: Final targetActor:',
		targetActor ? `${targetActor.name} (${targetActor.type})` : 'undefined'
	);
	console.log('Daggerheart | spendHope: targetActor.system:', targetActor.system ? 'exists' : 'undefined');
	console.log('Daggerheart | spendHope: targetActor.system.hope:', targetActor.system?.hope ? 'exists' : 'undefined');

	if (!targetActor.system?.hope) {
		console.error(`Actor ${targetActor.name} does not have a hope system`);
		ui.notifications.error(`${targetActor.name} does not have a hope system.`);
		return false;
	}

	const canModify = game.user.isGM || game.user.hasRole('ASSISTANT') || targetActor.isOwner;

	if (!canModify) {
		console.warn(`User does not have permission to modify ${targetActor.name}'s hope`);
		ui.notifications.warn(`You do not have permission to modify ${targetActor.name}'s hope.`);
		return false;
	}

	const currentHope = parseInt(targetActor.system.hope.value) || 0;
	const maxHope = parseInt(targetActor.system.hope.max) || 6;
	const newHope = Math.max(0, currentHope - amount);
	const actualAmount = currentHope - newHope;

	if (actualAmount <= 0) {
		console.warn(`${targetActor.name} doesn't have enough hope to spend (${currentHope} available)`);
		ui.notifications.warn(`${targetActor.name} doesn't have enough hope to spend.`);
		return false;
	}

	try {
		await targetActor.update({
			'system.hope.value': newHope,
		});

		const message =
			actualAmount === 1
				? `${targetActor.name} spends 1 hope. Current hope: ${newHope}/${maxHope}`
				: `${targetActor.name} spends ${actualAmount} hope. Current hope: ${newHope}/${maxHope}`;

		ui.notifications.info(message);

		ChatMessage.create({
			user: game.user.id,
			speaker: ChatMessage.getSpeaker({ actor: targetActor }),
			content: `<div class="hope-spend-message">
        <h3><i class="fas fa-star"></i> Hope Spent</h3>
        <p><strong>${targetActor.name}</strong> spends <strong>${actualAmount}</strong> hope.</p>
        <p>Current hope: <strong>${newHope}/${maxHope}</strong></p>
        ${newHope === 0 ? '<p class="hope-warning"><em>No hope remaining!</em></p>' : ''}
      </div>`,
			flags: {
				'uo-msg': {
					messageType: 'hopeSpent',
					actorId: targetActor.id,
					amountSpent: actualAmount,
					currentHope: newHope,
					maxHope: maxHope,
				},
			},
		});

		return true;
	} catch (error) {
		console.error('Error spending hope:', error);
		ui.notifications.error('Error spending hope. Check console for details.');
		return false;
	}
}

/**
 * Gain hope
 * @param {Actor|null} actor
 * @param {number} amount
 * @returns {Promise<boolean>}
 */
export async function gainHope(actor = null, amount = 1) {
	if (game.paused) {
		console.log('Daggerheart | Hope gaining skipped - game is paused');
		ui.notifications.info('Hope gaining skipped - game is paused');
		return false;
	}

	if (!Number.isInteger(amount) || amount <= 0) {
		console.error('Hope amount must be a positive integer');
		ui.notifications.error('Hope amount must be a positive integer.');
		return false;
	}

	let targetActor = actor;

	if (!targetActor) {
		console.log('Daggerheart | gainHope: No actor provided, attempting to find target actor');

		const activeSheet = Object.values(ui.windows).find(app => app instanceof ActorSheet && app.rendered);

		console.log('Daggerheart | gainHope: Active sheet found:', activeSheet ? activeSheet.constructor.name : 'none');
		console.log('Daggerheart | gainHope: Active sheet actor:', activeSheet?.actor?.name || 'none');

		if (activeSheet?.actor) {
			targetActor = activeSheet.actor;
			console.log(
				`Daggerheart | gainHope: Using actor from active sheet: ${targetActor.name} (type: ${targetActor.type})`
			);
		} else {
			const selectedTokens = canvas.tokens?.controlled || [];
			console.log('Daggerheart | gainHope: Selected tokens count:', selectedTokens.length);

			if (selectedTokens.length === 1) {
				targetActor = selectedTokens[0].actor;
				console.log(
					`Daggerheart | gainHope: Using actor from selected token: ${targetActor.name} (type: ${targetActor.type})`
				);
			} else if (selectedTokens.length > 1) {
				console.error('Multiple tokens selected. Please select only one token or specify an actor.');
				ui.notifications.error('Multiple tokens selected. Please select only one token.');
				return false;
			} else {
				console.error('No actor specified, no active character sheet, and no token selected.');
				ui.notifications.error('No target found. Please select a token, open a character sheet, or specify an actor.');
				return false;
			}
		}
	}

	if (!targetActor) {
		console.error('Daggerheart | gainHope: No valid actor found for hope gaining');
		ui.notifications.error('No valid actor found.');
		return false;
	}

	console.log(
		'Daggerheart | gainHope: Final targetActor:',
		targetActor ? `${targetActor.name} (${targetActor.type})` : 'undefined'
	);
	console.log('Daggerheart | gainHope: targetActor.system:', targetActor.system ? 'exists' : 'undefined');
	console.log('Daggerheart | gainHope: targetActor.system.hope:', targetActor.system?.hope ? 'exists' : 'undefined');

	if (!targetActor.system?.hope) {
		console.error(`Actor ${targetActor.name} does not have a hope system`);
		ui.notifications.error(`${targetActor.name} does not have a hope system.`);
		return false;
	}

	const canModify = game.user.isGM || game.user.hasRole('ASSISTANT') || targetActor.isOwner;

	if (!canModify) {
		console.warn(`User does not have permission to modify ${targetActor.name}'s hope`);
		ui.notifications.warn(`You do not have permission to modify ${targetActor.name}'s hope.`);
		return false;
	}

	const currentHope = parseInt(targetActor.system.hope.value) || 0;
	const maxHope = parseInt(targetActor.system.hope.max) || 6;
	const newHope = Math.min(maxHope, currentHope + amount);
	const actualAmount = newHope - currentHope;

	if (actualAmount <= 0) {
		console.warn(`${targetActor.name} already has maximum hope (${maxHope})`);
		ui.notifications.warn(`${targetActor.name} already has maximum hope.`);
		return false;
	}

	try {
		await targetActor.update({
			'system.hope.value': newHope,
		});

		const message =
			actualAmount === 1
				? `${targetActor.name} gains 1 hope. Current hope: ${newHope}/${maxHope}`
				: `${targetActor.name} gains ${actualAmount} hope. Current hope: ${newHope}/${maxHope}`;

		ui.notifications.info(message);

		ChatMessage.create({
			user: game.user.id,
			speaker: ChatMessage.getSpeaker({ actor: targetActor }),
			content: `<div class="hope-gain-message">
        <h3><i class="fas fa-star"></i> Hope Gained</h3>
        <p><strong>${targetActor.name}</strong> gains <strong>${actualAmount}</strong> hope.</p>
        <p>Current hope: <strong>${newHope}/${maxHope}</strong></p>
        ${newHope >= maxHope ? '<p class="hope-max"><em>Maximum hope reached!</em></p>' : ''}
      </div>`,
			flags: {
				'uo-msg': {
					messageType: 'hopeGained',
					actorId: targetActor.id,
					amountGained: actualAmount,
					currentHope: newHope,
					maxHope: maxHope,
				},
			},
		});

		return true;
	} catch (error) {
		console.error('Error gaining hope:', error);
		ui.notifications.error('Error gaining hope. Check console for details.');
		return false;
	}
}

/**
 * Create spendHope macro
 * @param {number} amount
 * @param {number} slot
 * @returns {Promise}
 */
export async function createSpendHopeMacro(amount = 1, slot = null) {
	const command = `const amount = ${amount};
if (typeof spendHope === 'function') {
  await spendHope(null, amount);
} else {
  ui.notifications.error("spendHope function not available. Make sure the Daggerheart system is properly loaded.");
}`;

	const macroName = amount === 1 ? 'Spend Hope' : `Spend ${amount} Hope`;
	let macro =
		game.macros.find(m => m.name === macroName && m.flags?.['daggerheart.spendHopeMacro']) ||
		game.macros.find(m => m.name === macroName && m.command === command);

	if (!macro) {
		macro = await Macro.create({
			name: macroName,
			type: 'script',
			img: 'icons/svg/sun.svg',
			command: command,
			flags: { 'daggerheart.spendHopeMacro': true },
		});
	}

	if (slot !== null) {
		game.user.assignHotbarMacro(macro, slot);
	}

	return macro;
}

/**
 * Create gainHope macro
 * @param {number} amount
 * @param {number} slot
 * @returns {Promise}
 */
export async function createGainHopeMacro(amount = 1, slot = null) {
	const command = `const amount = ${amount};
if (typeof gainHope === 'function') {
  await gainHope(null, amount);
} else {
  ui.notifications.error("gainHope function not available. Make sure the Daggerheart system is properly loaded.");
}`;

	const macroName = amount === 1 ? 'Gain Hope' : `Gain ${amount} Hope`;
	let macro =
		game.macros.find(m => m.name === macroName && m.flags?.['daggerheart.gainHopeMacro']) ||
		game.macros.find(m => m.name === macroName && m.command === command);

	if (!macro) {
		macro = await Macro.create({
			name: macroName,
			type: 'script',
			img: 'icons/svg/sun.svg',
			command: command,
			flags: { 'daggerheart.gainHopeMacro': true },
		});
	}

	if (slot !== null) {
		game.user.assignHotbarMacro(macro, slot);
	}

	return macro;
}

/**
 * Clear stress
 * @param {Actor|null} actor
 * @param {number} amount
 * @returns {Promise<boolean>}
 */
export async function clearStress(actor = null, amount = 1) {
	if (game.paused) {
		console.log('Daggerheart | Stress clearing skipped - game is paused');
		ui.notifications.info('Stress clearing skipped - game is paused');
		return false;
	}

	if (!Number.isInteger(amount) || amount <= 0) {
		console.error('Stress amount must be a positive integer');
		ui.notifications.error('Stress amount must be a positive integer.');
		return false;
	}

	let targetActor = actor;

	if (!targetActor) {
		console.log('Daggerheart | clearStress: No actor provided, attempting to find target actor');

		const activeSheet = Object.values(ui.windows).find(app => app instanceof ActorSheet && app.rendered);

		console.log('Daggerheart | clearStress: Active sheet found:', activeSheet ? activeSheet.constructor.name : 'none');
		console.log('Daggerheart | clearStress: Active sheet actor:', activeSheet?.actor?.name || 'none');

		if (activeSheet?.actor) {
			targetActor = activeSheet.actor;
			console.log(
				`Daggerheart | clearStress: Using actor from active sheet: ${targetActor.name} (type: ${targetActor.type})`
			);
		} else {
			const selectedTokens = canvas.tokens?.controlled || [];
			console.log('Daggerheart | clearStress: Selected tokens count:', selectedTokens.length);

			if (selectedTokens.length === 1) {
				targetActor = selectedTokens[0].actor;
				console.log(
					`Daggerheart | clearStress: Using actor from selected token: ${targetActor.name} (type: ${targetActor.type})`
				);
			} else if (selectedTokens.length > 1) {
				console.error('Multiple tokens selected. Please select only one token or specify an actor.');
				ui.notifications.error('Multiple tokens selected. Please select only one token.');
				return false;
			} else {
				console.error('No actor specified, no active character sheet, and no token selected.');
				ui.notifications.error('No target found. Please select a token, open a character sheet, or specify an actor.');
				return false;
			}
		}
	}

	if (!targetActor) {
		console.error('Daggerheart | clearStress: No valid actor found for stress clearing');
		ui.notifications.error('No valid actor found.');
		return false;
	}

	console.log(
		'Daggerheart | clearStress: Final targetActor:',
		targetActor ? `${targetActor.name} (${targetActor.type})` : 'undefined'
	);
	console.log('Daggerheart | clearStress: targetActor.system:', targetActor.system ? 'exists' : 'undefined');
	console.log(
		'Daggerheart | clearStress: targetActor.system.stress:',
		targetActor.system?.stress ? 'exists' : 'undefined'
	);

	if (!targetActor.system?.stress) {
		console.error(`Actor ${targetActor.name} does not have a stress system`);
		ui.notifications.error(`${targetActor.name} does not have a stress system.`);
		return false;
	}

	const canModify = game.user.isGM || game.user.hasRole('ASSISTANT') || targetActor.isOwner;

	if (!canModify) {
		console.warn(`User does not have permission to modify ${targetActor.name}'s stress`);
		ui.notifications.warn(`You do not have permission to modify ${targetActor.name}'s stress.`);
		return false;
	}

	const currentStress = parseInt(targetActor.system.stress.value) || 0;
	const maxStress = parseInt(targetActor.system.stress.max) || 6;
	const newStress = Math.max(0, currentStress - amount);
	const actualAmount = currentStress - newStress;

	if (actualAmount <= 0) {
		console.warn(`${targetActor.name} doesn't have any stress to clear (${currentStress} current)`);
		ui.notifications.warn(`${targetActor.name} doesn't have any stress to clear.`);
		return false;
	}

	try {
		await targetActor.update({
			'system.stress.value': newStress,
		});

		const message =
			actualAmount === 1
				? `${targetActor.name} clears 1 stress. Current stress: ${newStress}/${maxStress}`
				: `${targetActor.name} clears ${actualAmount} stress. Current stress: ${newStress}/${maxStress}`;

		ui.notifications.info(message);

		ChatMessage.create({
			user: game.user.id,
			speaker: ChatMessage.getSpeaker({ actor: targetActor }),
			content: `<div class="stress-clear-message">
        <h3><i class="fas fa-heart"></i> Stress Cleared</h3>
        <p><strong>${targetActor.name}</strong> clears <strong>${actualAmount}</strong> stress.</p>
        <p>Current stress: <strong>${newStress}/${maxStress}</strong></p>
        ${newStress === 0 ? '<p class="stress-cleared"><em>All stress cleared!</em></p>' : ''}
      </div>`,
			flags: {
				'uo-msg': {
					messageType: 'stressCleared',
					actorId: targetActor.id,
					amountCleared: actualAmount,
					currentStress: newStress,
					maxStress: maxStress,
				},
			},
		});

		return true;
	} catch (error) {
		console.error('Error clearing stress:', error);
		ui.notifications.error('Error clearing stress. Check console for details.');
		return false;
	}
}

/**
 * Create spendStress macro
 * @param {number} amount
 * @param {number} slot
 * @returns {Promise}
 */
export async function createSpendStressMacro(amount = 1, slot = null) {
	const command = `const amount = ${amount};
if (typeof game.daggerheart?.spendStress === 'function') {
  await game.daggerheart.spendStress(null, amount);
} else {
  ui.notifications.error("spendStress function not available. Make sure the Daggerheart system is properly loaded.");
}`;

	const macroName = amount === 1 ? 'Apply Stress' : `Apply ${amount} Stress`;
	let macro =
		game.macros.find(m => m.name === macroName && m.flags?.['daggerheart.spendStressMacro']) ||
		game.macros.find(m => m.name === macroName && m.command === command);

	if (!macro) {
		macro = await Macro.create({
			name: macroName,
			type: 'script',
			img: 'icons/svg/hazard.svg',
			command: command,
			flags: { 'daggerheart.spendStressMacro': true },
		});
	}

	if (slot !== null) {
		game.user.assignHotbarMacro(macro, slot);
	}

	return macro;
}

/**
 * Create clearStress macro
 * @param {number} amount
 * @param {number} slot
 * @returns {Promise}
 */
export async function createClearStressMacro(amount = 1, slot = null) {
	const command = `const amount = ${amount};
if (typeof clearStress === 'function') {
  await clearStress(null, amount);
} else {
  ui.notifications.error("clearStress function not available. Make sure the Daggerheart system is properly loaded.");
}`;

	const macroName = amount === 1 ? 'Clear Stress' : `Clear ${amount} Stress`;
	let macro =
		game.macros.find(m => m.name === macroName && m.flags?.['daggerheart.clearStressMacro']) ||
		game.macros.find(m => m.name === macroName && m.command === command);

	if (!macro) {
		macro = await Macro.create({
			name: macroName,
			type: 'script',
			img: 'icons/svg/heal.svg',
			command: command,
			flags: { 'daggerheart.clearStressMacro': true },
		});
	}

	if (slot !== null) {
		game.user.assignHotbarMacro(macro, slot);
	}

	return macro;
}

/**
 * Create macro from drop
 * @param {Object} data
 * @param {number} slot
 * @returns {Promise}
 */
export async function createDaggerheartMacro(data, slot) {
	if (data.type === 'Item') {
		const item = await fromUuid(data.uuid);
		const isItemInActor =
			data.uuid.startsWith('Actor.') && item && item.parent && item.parent.id === data.uuid.split('.')[1];
		let command = '';

		if (!item) return false;

		if (item.type === 'weapon' && isItemInActor) {
			const actorId = data.uuid.split('.')[1];
			command = `const actor = game.actors.get("${actorId}");
const weaponName = "${item.name}";
// Figure out if it's the main or off-hand weapon, get the modifier.
const traitValue = ["weapon-main", "weapon-off"].reduce((acc, type) => {
  if (actor.system[type]?.name === weaponName) {
    acc = actor.system[type]["to-hit"].value;
  }
  return acc;
}, null);

if (traitValue === null) {
  ui.notifications.warn(\`\${actor.name} does not have a \${weaponName} equipped.\`);
  return;
}

const title = \`Roll for \$\{weaponName\}\`;

actor.sheet._pendingRollType = "attack";
actor.sheet._pendingWeaponName = weaponName;

await game.daggerheart.rollHandler.dualityWithDialog({
  title,
  traitValue,
  actor,
});`;
		} else {
			command = `const item = await fromUuid("${data.uuid}");
  if (!item) {
    ui.notifications.warn("Item not found!");
    return;
  }

  const itemData = item.system;
  const description = await TextEditor.enrichHTML(
    itemData.description,
    { enrichers: false, secrets: item.isOwner, async: true }
  );
  const chatCard = globalThis.daggerheart?.buildItemCardChat ?
    globalThis.daggerheart.buildItemCardChat({
      itemId: item.id,
      actorId: item.parent?.id || '',
      image: item.img,
      name: item.name,
      category: itemData.category || '',
      rarity: itemData.rarity || '',
      description,
      itemType: item.type,
      system: item.system
    }) : \`<div class="item-card-chat">\${item.name}</div>\`;

  ChatMessage.create({
      user: game.user.id,
      speaker: item.parent ? ChatMessage.getSpeaker({ actor: item.parent }) : ChatMessage.getSpeaker(),
      content: chatCard
  });`;
		}

		const macroName = `${item.name}`;
		let macro =
			game.macros.find(m => m.name === macroName && m.flags?.['daggerheart.itemMacro']) ||
			game.macros.find(m => m.name === macroName && m.command === command);

		if (!macro) {
			macro = await Macro.create({
				name: macroName,
				type: 'script',
				img: item.img,
				command: command,
				flags: { 'daggerheart.itemMacro': true },
			});
		}

		game.user.assignHotbarMacro(macro, slot);
		return false;
	}

	if (!data.roll || !data.label) return false;
	const command = `const roll = new Roll("${data.roll}", actor ? actor.getRollData() : {});
  await roll.evaluate();
      try {
      const chatMessage = await ChatMessage.create({
        content: \`
          <div class="dice-roll">
            <div class="dice-result">
              <div class="dice-formula">\${roll.formula}</div>
              <div class="dice-total">\${roll.total}</div>
            </div>
          </div>
        \`,
        speaker,
        flavor: "${data.label}",
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        rolls: [roll]
      });

      if (chatMessage?.id && game.dice3d) {
        await game.dice3d.waitFor3DAnimationByMessageID(chatMessage.id);
      }
    } catch (error) {
      console.error("Error creating macro roll chat message:", error);
      ui.notifications.warn("Chat message failed to send, but roll was completed.");
    }`;
	let macro =
		game.macros.find(m => m.name === data.label && m.flags?.['daggerheart.attrMacro']) ||
		game.macros.find(m => m.name === data.label && m.command === command);
	if (!macro) {
		macro = await Macro.create({
			name: data.label,
			type: 'script',
			command: command,
			flags: { 'daggerheart.attrMacro': true },
		});
	}
	game.user.assignHotbarMacro(macro, slot);
	return false;
}

// Text Enricher: Auto-link resource phrases

/**
 * Word to number
 * @param {string} word
 * @returns {number}
 */
function _wordToNumber(word) {
	if (!word) return NaN;
	word = word.toLowerCase();
	switch (word) {
		case 'a':
		case 'one':
			return 1;
		case 'two':
			return 2;
		case 'three':
			return 3;
		case 'four':
			return 4;
		case 'five':
			return 5;
		case 'six':
			return 6;
		case 'seven':
			return 7;
		case 'eight':
			return 8;
		case 'nine':
			return 9;
		case 'ten':
			return 10;
		default:
			return Number(word);
	}
}

Hooks.once('init', () => {
	// Configuration for phrase detection
	//
	// EXCLUSIONS: Phrases that should never be converted to buttons
	// INCLUSIONS: Custom phrases that should be treated as aliases for standard resource actions
	//
	// To add new exclusions or inclusions, modify the PHRASE_CONFIG object below
	const PHRASE_CONFIG = {
		exclusions: ['without marking a stress', 'without marking stress'],
		inclusions: {
			// Example mappings - add custom phrase mappings here
			// "take damage": "mark 1 hit point",
			// "use energy": "spend 1 hope",
			// "get stressed": "mark 1 stress"
		},
	};

	const VERB_PATTERN = 'spend|spending|use|gain|add|lose|remove|clear|mark|recover|heal';
	const NUM_PATTERN = '\\d+|a|one|two|three|four|five|six|seven|eight|nine|ten';
	const RES_PATTERN = 'fear(?:s)?|hope(?:s)?|stress|armor\\s+slots?|hit\\s+points?';
	const masterPattern = new RegExp(
		`(?:^|[^>a-zA-Z])(?:(${VERB_PATTERN})\\s+)?([+\\-]?\\s*(?:${NUM_PATTERN}))\\s+(${RES_PATTERN})(?![^<]*</a>)`,
		'gi'
	);

	// Create patterns for inclusions
	const inclusionPatterns = Object.keys(PHRASE_CONFIG.inclusions).map(phrase => ({
		pattern: new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
		replacement: PHRASE_CONFIG.inclusions[phrase],
	}));

	/**
	 * Check if text should be excluded from enrichment
	 * @param {string} contextText
	 * @returns {boolean}
	 */
	function _shouldExclude(contextText) {
		return PHRASE_CONFIG.exclusions.some(exclusion => {
			const pattern = new RegExp(exclusion.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
			return pattern.test(contextText);
		});
	}

	/**
	 * Check for inclusion aliases and return replacement text
	 * @param {string} text
	 * @returns {string|null}
	 */
	function _checkInclusions(text) {
		for (const inclusion of inclusionPatterns) {
			if (inclusion.pattern.test(text)) {
				return inclusion.replacement;
			}
		}
		return null;
	}

	/**
	 * Canonical resource
	 * @param {string} resStr
	 * @returns {string}
	 */
	function _canonicalResource(resStr) {
		resStr = resStr.toLowerCase();
		if (resStr.startsWith('fear')) return 'fear';
		if (resStr.startsWith('hope')) return 'hope';
		if (resStr.startsWith('stress')) return 'stress';
		if (resStr.includes('armor')) return 'armor';
		return 'hp';
	}

	/**`
	 * Parse delta
	 * @param {string} amountStr
	 * @param {string|null} verb
	 * @param {string} resourceKey
	 */
	function _parseDelta(amountStr, verb, resourceKey) {
		amountStr = amountStr.replace(/\s+/g, '');
		let sign = 1;
		if (amountStr.startsWith('+')) {
			amountStr = amountStr.slice(1);
			sign = 1;
		} else if (amountStr.startsWith('-')) {
			amountStr = amountStr.slice(1);
			sign = -1;
		}

		let val = _wordToNumber(amountStr) || 1;

		if (sign === 1 && verb) {
			verb = verb.toLowerCase();

			// For HP and armor: lose/damage = positive, recover/heal = negative
			if (resourceKey === 'hp' || resourceKey === 'armor') {
				if (['lose', 'add', 'gain', 'mark'].includes(verb)) sign = 1;
				else if (['recover', 'heal', 'remove', 'clear'].includes(verb)) sign = -1;
			} else {
				// For fear/hope/stress: spend/use/lose = negative, gain = positive
				if (['spend', 'spending', 'use', 'lose', 'remove', 'clear'].includes(verb)) sign = -1;
				else sign = 1;
			}
		}
		return val * sign;
	}

	function _buildAnchor(resourceKey, delta, verbHint = null) {
		const a = document.createElement('a');
		a.classList.add('dh-resource-btn', 'dh-btn', 'dh-btn--primary');
		a.dataset.resource = resourceKey;
		a.dataset.delta = String(delta);

		let normalizedVerb = verbHint ? verbHint.toLowerCase() : '';
		let labelAction;
		if (resourceKey === 'hp' || resourceKey === 'armor') {
			if (['lose', 'add', 'gain'].includes(normalizedVerb) || delta > 0) labelAction = 'Mark';
			else labelAction = 'Clear';
		} else if (resourceKey === 'stress') {
			labelAction = normalizedVerb === 'clear' || delta < 0 ? 'Clear' : 'Mark';
		} else {
			labelAction = normalizedVerb === 'gain' || delta > 0 ? 'Gain' : 'Spend';
		}

		const amount = Math.abs(delta);
		const resLabel =
			resourceKey === 'armor'
				? amount === 1
					? 'Armor Slot'
					: 'Armor Slots'
				: resourceKey === 'hp'
					? 'Hit Point'
					: `${resourceKey.charAt(0).toUpperCase()}${resourceKey.slice(1)}`;
		a.innerHTML = `${labelAction} ${amount} ${resLabel}`;
		a.setAttribute('data-icon', 'fa-solid fa-hand-pointer'); // Store icon for future use
		return a;
	}

	function _safeRegisterEnricher(cfg) {
		if (typeof TextEditor.registerEnricher === 'function') {
			TextEditor.registerEnricher(cfg);
		} else if (globalThis.CONFIG?.TextEditor?.enrichers) {
			CONFIG.TextEditor.enrichers.push(cfg);
		} else {
			console.error('Daggerheart | Unable to register text enricher – unsupported Foundry version');
		}
	}

	_safeRegisterEnricher({
		pattern: masterPattern,
		enricher: (match, options) => {
			// Skip if we're in an item card context
			if (options?.inItemCard) return match[0];

			// Skip if the content is already enriched (contains our buttons)
			const fullText = match.input || '';
			if (fullText.includes('dh-resource-btn') || fullText.includes('data-enriched="true"')) {
				return match[0];
			}

			// Skip if we're inside dh-no-enrich spans
			const matchIndex = match.index || 0;
			const beforeMatch = fullText.substring(0, matchIndex);

			// Check if we're inside a dh-no-enrich span
			const lastNoEnrichOpen = beforeMatch.lastIndexOf('<span class="dh-no-enrich"');
			const lastNoEnrichClose = beforeMatch.lastIndexOf('</span>');
			if (lastNoEnrichOpen > lastNoEnrichClose) {
				return match[0];
			}

			// Skip if we're inside any existing button or anchor
			const lastAnchorOpen = beforeMatch.lastIndexOf('<a');
			const lastAnchorClose = beforeMatch.lastIndexOf('</a>');
			const lastButtonOpen = beforeMatch.lastIndexOf('<button');
			const lastButtonClose = beforeMatch.lastIndexOf('</button>');

			if (lastAnchorOpen > lastAnchorClose || lastButtonOpen > lastButtonClose) {
				return match[0];
			}

			// Skip specific phrases that should not be enriched
			const matchText = match[0];
			const contextStart = Math.max(0, matchIndex - 20);
			const contextText = fullText.substring(contextStart, matchIndex + matchText.length + 10);

			// Check exclusions
			if (_shouldExclude(contextText)) {
				return match[0];
			}

			// Determine the verb (action) for this resource phrase. If the regex captured one directly we use it;
			// otherwise, look back in the same sentence for the nearest preceding verb so phrases like
			// "clear 2 Hit Points or 2 Stress" apply the verb "clear" to both resources.
			let verb = match[1] || null;

			if (!verb) {
				const lastSentenceBreak = Math.max(
					beforeMatch.lastIndexOf('.'),
					beforeMatch.lastIndexOf('!'),
					beforeMatch.lastIndexOf('?')
				);
				const searchSegment = beforeMatch.slice(lastSentenceBreak + 1);

				const verbSearchRe = new RegExp(`\\b(${VERB_PATTERN})\\b`, 'gi');
				let verbMatch;
				for (const m of searchSegment.matchAll(verbSearchRe)) {
					verbMatch = m;
				}
				if (verbMatch && verbMatch[1]) verb = verbMatch[1];
			}

			if (!verb) {
				return match[0];
			}

			const amountStr = match[2];
			const resStr = match[3];
			const resourceKey = _canonicalResource(resStr);
			const delta = _parseDelta(amountStr, verb, resourceKey);

			const anchor = _buildAnchor(resourceKey, delta, verb);
			anchor.setAttribute('data-enriched', 'true');
			return anchor;
		},
	});

	// Register enricher for inclusion aliases
	if (inclusionPatterns.length > 0) {
		const inclusionPattern = new RegExp(inclusionPatterns.map(p => `(${p.pattern.source})`).join('|'), 'gi');

		_safeRegisterEnricher({
			pattern: inclusionPattern,
			enricher: (match, options) => {
				// Skip if we're in an item card context
				if (options?.inItemCard) return match[0];

				const fullText = match.input || '';

				// Skip if already enriched
				if (fullText.includes('dh-resource-btn') || fullText.includes('data-enriched="true"')) {
					return match[0];
				}

				// Check for inclusion replacement
				const replacement = _checkInclusions(match[0]);
				if (!replacement) return match[0];

				// Parse the replacement text using the same logic as the main enricher
				const replacementMatch = replacement.match(masterPattern);
				if (!replacementMatch) return match[0];

				const verb = replacementMatch[1];
				const amountStr = replacementMatch[2];
				const resStr = replacementMatch[3];
				const resourceKey = _canonicalResource(resStr);
				const delta = _parseDelta(amountStr, verb, resourceKey);

				const anchor = _buildAnchor(resourceKey, delta, verb);
				anchor.setAttribute('data-enriched', 'true');
				return anchor;
			},
		});
	}
});

/**
 * Global click listener
 */
Hooks.once('ready', () => {
	document.addEventListener('click', async event => {
		const btn = event.target.closest('.dh-resource-btn, .dh-fear-btn');
		if (!btn) return;

		if (btn.classList.contains('dh-fear-btn')) {
			const amt = Number(btn.dataset.amount) || 1;
			const action = btn.dataset.action;
			if (action === 'spendFear' && typeof spendFear === 'function') {
				await spendFear(amt);
			} else if (action === 'gainFear' && typeof gainFear === 'function') {
				await gainFear(amt);
			}
			return;
		}

		const delta = Number(btn.dataset.delta) || 0;
		const resource = btn.dataset.resource;

		switch (resource) {
			case 'fear':
				if (delta < 0) await spendFear(-delta);
				else await gainFear(delta);
				break;
			case 'hope':
				if (delta < 0) await spendHope(null, -delta);
				else await gainHope(null, delta);
				break;
			case 'stress':
				if (delta < 0) await clearStress(null, -delta);
				else await spendStress(null, delta);
				break;
			case 'armor':
				await adjustArmorSlots(null, delta);
				break;
			case 'hp':
				if (delta > 0) {
					// Positive delta means damage (mark hit points) - use direct damage to bypass thresholds
					await applyDirectDamage(null, delta, null, true);
				} else {
					// Negative delta means healing (clear hit points)
					await applyHealing(null, -delta, null, true);
				}
				break;
			default:
				ui.notifications.warn('Unknown resource type.');
		}
	});
});

// Placeholder functions

/**
 * Adjust armor slots
 * @param {number} delta
 */
export async function adjustArmorSlots(actor = null, delta = 1) {
	// Validate delta (non-zero integer)
	if (!Number.isInteger(delta) || delta === 0) {
		console.error('Armor slot delta must be a non-zero integer');
		ui.notifications.error('Armor slot amount must be a non-zero integer.');
		return false;
	}

	let targetActor = actor;

	// Actor detection (same as spendStress)
	if (!targetActor) {
		const activeSheet = Object.values(ui.windows).find(app => app instanceof ActorSheet && app.rendered);
		if (activeSheet?.actor) {
			targetActor = activeSheet.actor;
		} else {
			const selectedTokens = canvas.tokens?.controlled || [];
			if (selectedTokens.length === 1) targetActor = selectedTokens[0].actor;
		}
	}

	if (!targetActor) {
		ui.notifications.error('No target actor found for armor slot adjustment.');
		return false;
	}

	// Only character actors have armor slots
	if (targetActor.type !== 'character') {
		ui.notifications.warn('Armor slots are only available for character actors.');
		return false;
	}

	// Check data path exists
	const armorSlotObj = targetActor.system?.defenses?.['armor-slots'];
	const armorMaxObj = targetActor.system?.defenses?.armor;
	if (!armorSlotObj || !armorMaxObj) {
		ui.notifications.error('This actor does not have armor slot data.');
		return false;
	}

	const current = parseInt(armorSlotObj.value) || 0;
	const max = parseInt(armorMaxObj.value) || 0;
	const newVal = Math.max(0, Math.min(max, current + delta));
	const actual = newVal - current;
	if (actual === 0) {
		ui.notifications.info('Armor slots already at limit.');
		return false;
	}

	// Permission check
	const canModify = game.user.isGM || game.user.hasRole('ASSISTANT') || targetActor.isOwner;
	if (!canModify) {
		ui.notifications.warn(`You do not have permission to modify ${targetActor.name}'s armor slots.`);
		return false;
	}

	try {
		await targetActor.update({
			'system.defenses.armor-slots.value': newVal,
		});

		const actionText = actual > 0 ? 'ARMOR USED' : 'ARMOR FREED';
		const detailText =
			actual > 0
				? `${targetActor.name} uses ${actual} armor slot${actual === 1 ? '' : 's'}.`
				: `${targetActor.name} frees ${-actual} armor slot${actual === -1 ? '' : 's'}.`;

		ui.notifications.info(detailText);

		ChatMessage.create({
			user: game.user.id,
			speaker: ChatMessage.getSpeaker({ actor: targetActor }),
			content: `<div class="armor-slot-message">
        <h3><i class="fa-solid fa-shield-halved"></i>${actionText}</h3>
        <p>${detailText}</p>
        <p>Armor slots: ${newVal}/${max}</p>
      </div>`,
			flags: { 'uo-msg': { messageType: 'armorSlots', delta: actual } },
		});
		return true;
	} catch (e) {
		console.error('Error updating armor slots', e);
		ui.notifications.error('Failed to update armor slots.');
		return false;
	}
}

/**
 * Configure phrase detection for the text enricher
 * @param {Object} config - Configuration object
 * @param {string[]} config.exclusions - Array of phrases to exclude from enrichment
 * @param {Object} config.inclusions - Object mapping custom phrases to standard resource actions
 * @example
 * // Add exclusions and inclusions
 * configurePhraseDetection({
 *   exclusions: ["without marking a stress", "avoid spending hope"],
 *   inclusions: {
 *     "take damage": "mark 1 hit point",
 *     "use energy": "spend 1 hope",
 *     "get stressed": "mark 1 stress"
 *   }
 * });
 */
export function configurePhraseDetection(config) {
	if (!config) {
		console.warn('Daggerheart | configurePhraseDetection called with no config');
		return;
	}

	console.log('Daggerheart | Phrase detection configuration is static and must be set before system initialization.');
	console.log('Daggerheart | To modify phrase detection, edit the PHRASE_CONFIG object in module/spending-system.js');
	console.log('Daggerheart | Requested config:', config);
}
