import { DamageRollDialog } from '../applications/damage-roll-dialog.js';

const undoData = new Map();

export async function applyDamage(
	targetActors = null,
	damageAmount,
	sourceActor = null,
	createUndo = true,
	armorSlotsUsed = 0
) {
	if (!Number.isInteger(damageAmount) || damageAmount <= 0) {
		console.error('Damage amount must be a positive integer');
		ui.notifications.error('Damage amount must be a positive integer.');
		return { success: false, undoId: null };
	}

	const isArmorSlotsObject = typeof armorSlotsUsed === 'object' && armorSlotsUsed !== null;
	if (!isArmorSlotsObject && (!Number.isInteger(armorSlotsUsed) || armorSlotsUsed < 0)) {
		console.error('Armor slots used must be a non-negative integer or object mapping actor IDs to armor slots');
		ui.notifications.error(
			'Armor slots used must be a non-negative integer or object mapping actor IDs to armor slots.'
		);
		return { success: false, undoId: null };
	}

	let targets = targetActors;

	if (!targets) {
		try {
			targets = _getTargetActors();
		} catch (error) {
			console.error('Target selection failed:', error.message);
			ui.notifications.error(error.message);
			return { success: false, undoId: null };
		}
	}

	if (!Array.isArray(targets)) {
		targets = [targets];
	}

	if (!targets || targets.length === 0) {
		console.error('No valid target actors found for damage application');
		ui.notifications.error('No valid target actors found.');
		return { success: false, undoId: null };
	}

	let undoId = null;
	let undoRecord = null;

	if (createUndo) {
		undoId = `damage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		undoRecord = {
			type: 'damage',
			actors: [],
			damageAmount: damageAmount,
			armorSlotsUsed: armorSlotsUsed,
			sourceActorId: sourceActor?.id || null,
			timestamp: Date.now(),
		};
	}

	let successfulApplications = 0;
	const results = [];

	for (const target of targets) {
		if (!target) {
			console.warn('Skipping null target actor');
			continue;
		}

		if (!target.system?.health || !target.system?.threshold) {
			console.warn(`Actor ${target.name} does not have a health/threshold system`);
			ui.notifications.warn(`${target.name} does not have a health/threshold system.`);
			continue;
		}

		const currentHealth = parseInt(target.system.health.value) || 0;
		const maxHealth = parseInt(target.system.health.max) || 6;
		const thresholds = target.system.threshold;

		let currentArmorSlots = 0;
		let maxArmorSlots = 0;
		let armorSlotsToApply = 0;
		const isCharacter = target.type === 'character';

		if (isCharacter) {
			maxArmorSlots = parseInt(target.system.defenses?.armor?.value) || 0;
			currentArmorSlots = parseInt(target.system.defenses?.['armor-slots']?.value) || 0;

			let targetArmorSlots = 0;
			if (isArmorSlotsObject) {
				targetArmorSlots = armorSlotsUsed[target.id] || 0;
				if (targetArmorSlots === 0 && armorSlotsUsed[target.name]) {
					console.warn(
						`Damage Application: Using actor name "${target.name}" in armor slots mapping is DEPRECATED. Use actor ID "${target.id}" instead. Actor names are not unique and may cause issues.`
					);
					targetArmorSlots = armorSlotsUsed[target.name];
				}
			} else {
				targetArmorSlots = armorSlotsUsed;
			}

			if (targetArmorSlots > 0) {
				const availableSlots = maxArmorSlots - currentArmorSlots;
				armorSlotsToApply = Math.min(targetArmorSlots, availableSlots);

				if (armorSlotsToApply < targetArmorSlots) {
					console.warn(
						`${target.name} only has ${availableSlots} armor slots available, using ${armorSlotsToApply} instead of requested ${targetArmorSlots}`
					);
				}
			}
		}

		if (createUndo && undoRecord) {
			const isFromToken = !!target.token;

			const actorData = {
				originalHealth: currentHealth,
				actorName: target.name,
				actorType: target.type,
				isFromToken: isFromToken,
				tokenId: target.token?.id || null,
				sceneId: target.token?.scene?.id || null,
				actorId: isFromToken ? null : target.id,
			};

			if (isCharacter) {
				actorData.originalArmorSlots = currentArmorSlots;
				actorData.armorSlotsApplied = armorSlotsToApply;
			}

			undoRecord.actors.push(actorData);
		}

		const hpDamage = _calculateDamageToHP(damageAmount, thresholds);

		let finalHpDamage = hpDamage;
		if (isCharacter && armorSlotsToApply > 0) {
			finalHpDamage = Math.max(0, hpDamage - armorSlotsToApply);
			console.log(
				`${target.name} armor reduction: ${hpDamage} HP - ${armorSlotsToApply} armor = ${finalHpDamage} HP final damage`
			);
		}

		const newHealth = Math.min(maxHealth, currentHealth + finalHpDamage);
		const actualDamage = newHealth - currentHealth;

		if (actualDamage <= 0 && armorSlotsToApply <= 0) {
			console.warn(`${target.name} already has maximum damage (${maxHealth}) and no armor slots to consume`);
			ui.notifications.warn(`${target.name} is already at maximum damage.`);
			continue;
		}

		try {
			const updateData = {
				'system.health.value': newHealth,
			};

			if (isCharacter && armorSlotsToApply > 0) {
				const newArmorSlots = currentArmorSlots + armorSlotsToApply;
				updateData['system.defenses.armor-slots.value'] = newArmorSlots;
			}

			await target.update(updateData);

			successfulApplications++;
			results.push({
				target: target,
				actualDamage: actualDamage,
				hpDamage: hpDamage,
				finalHpDamage: finalHpDamage,
				armorSlotsUsed: armorSlotsToApply,
				newHealth: newHealth,
				maxHealth: maxHealth,
				thresholds: thresholds,
			});
		} catch (error) {
			console.error(`Error applying damage to ${target.name}:`, error);
			ui.notifications.error(`Error applying damage to ${target.name}.`);
		}
	}

	if (successfulApplications === 0) {
		return { success: false, undoId: null };
	}

	if (createUndo && undoRecord && undoRecord.actors.length > 0) {
		undoData.set(undoId, undoRecord);
	}

	await _sendDamageApplicationMessages(results, sourceActor, damageAmount, createUndo ? undoId : null);

	const targetNames = results.map(r => r.target.name).join(', ');
	const message = `Applied damage to: ${targetNames}`;
	ui.notifications.info(message);

	return { success: true, undoId: createUndo ? undoId : null };
}

export async function applyDirectDamage(targetActors = null, hpDamage, sourceActor = null, createUndo = true) {
	if (!Number.isInteger(hpDamage) || hpDamage <= 0) {
		console.error('HP damage amount must be a positive integer');
		ui.notifications.error('HP damage amount must be a positive integer.');
		return { success: false, undoId: null };
	}

	let targets = targetActors;

	if (!targets) {
		try {
			targets = _getTargetActors();
		} catch (error) {
			console.error('Target selection failed:', error.message);
			ui.notifications.error(error.message);
			return { success: false, undoId: null };
		}
	}

	if (!Array.isArray(targets)) {
		targets = [targets];
	}

	if (!targets || targets.length === 0) {
		console.error('No valid target actors found for direct damage application');
		ui.notifications.error('No valid target actors found.');
		return { success: false, undoId: null };
	}

	let undoId = null;
	let undoRecord = null;

	if (createUndo) {
		undoId = `direct_damage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		undoRecord = {
			type: 'direct_damage',
			actors: [],
			hpDamage: hpDamage,
			sourceActorId: sourceActor?.id || null,
			timestamp: Date.now(),
		};
	}

	let successfulApplications = 0;
	const results = [];

	for (const target of targets) {
		if (!target) {
			console.warn('Skipping null target actor');
			continue;
		}

		if (!target.system?.health) {
			console.warn(`Actor ${target.name} does not have a health system`);
			ui.notifications.warn(`${target.name} does not have a health system.`);
			continue;
		}

		const currentHealth = parseInt(target.system.health.value) || 0;
		const maxHealth = parseInt(target.system.health.max) || 6;

		if (createUndo && undoRecord) {
			const isFromToken = !!target.token;

			const actorData = {
				originalHealth: currentHealth,
				actorName: target.name,
				actorType: target.type,
				isFromToken: isFromToken,
				tokenId: target.token?.id || null,
				sceneId: target.token?.scene?.id || null,
				actorId: isFromToken ? null : target.id,
			};

			undoRecord.actors.push(actorData);
		}

		const newHealth = Math.min(maxHealth, currentHealth + hpDamage);
		const actualDamage = newHealth - currentHealth;

		if (actualDamage <= 0) {
			console.warn(`${target.name} already has maximum damage (${maxHealth})`);
			ui.notifications.warn(`${target.name} is already at maximum damage.`);
			continue;
		}

		try {
			await target.update({
				'system.health.value': newHealth,
			});

			successfulApplications++;
			results.push({
				target: target,
				actualDamage: actualDamage,
				hpDamage: hpDamage,
				newHealth: newHealth,
				maxHealth: maxHealth,
			});
		} catch (error) {
			console.error(`Error applying direct damage to ${target.name}:`, error);
			ui.notifications.error(`Error applying direct damage to ${target.name}.`);
		}
	}

	if (successfulApplications === 0) {
		return { success: false, undoId: null };
	}

	if (createUndo && undoRecord && undoRecord.actors.length > 0) {
		undoData.set(undoId, undoRecord);
	}

	await _sendDirectDamageApplicationMessages(results, sourceActor, hpDamage, createUndo ? undoId : null);

	const targetNames = results.map(r => r.target.name).join(', ');
	const message = `Applied direct damage to: ${targetNames}`;
	ui.notifications.info(message);

	return { success: true, undoId: createUndo ? undoId : null };
}

export async function applyHealing(targetActors = null, healAmount, sourceActor = null, createUndo = true) {
	if (!Number.isInteger(healAmount) || healAmount <= 0) {
		console.error('Heal amount must be a positive integer');
		ui.notifications.error('Heal amount must be a positive integer.');
		return { success: false, undoId: null };
	}

	let targets = targetActors;

	if (!targets) {
		try {
			targets = _getTargetActors();
		} catch (error) {
			console.error('Target selection failed:', error.message);
			ui.notifications.error(error.message);
			return { success: false, undoId: null };
		}
	}

	if (!Array.isArray(targets)) {
		targets = [targets];
	}

	if (!targets || targets.length === 0) {
		console.error('No valid target actors found for healing');
		ui.notifications.error('No valid target actors found.');
		return { success: false, undoId: null };
	}

	let undoId = null;
	let undoRecord = null;

	if (createUndo) {
		undoId = `healing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		undoRecord = {
			type: 'healing',
			actors: [],
			healAmount: healAmount,
			sourceActorId: sourceActor?.id || null,
			timestamp: Date.now(),
		};
	}

	let successfulApplications = 0;
	const results = [];

	for (const target of targets) {
		if (!target) {
			console.warn('Skipping null target actor');
			continue;
		}

		if (!target.system?.health) {
			console.warn(`Actor ${target.name} does not have a health system`);
			ui.notifications.warn(`${target.name} does not have a health system.`);
			continue;
		}

		const currentHealth = parseInt(target.system.health.value) || 0;
		const maxHealth = parseInt(target.system.health.max) || 6;

		if (createUndo && undoRecord) {
			const isFromToken = !!target.token;

			undoRecord.actors.push({
				originalHealth: currentHealth,
				actorName: target.name,
				actorType: target.type,
				isFromToken: isFromToken,
				tokenId: target.token?.id || null,
				sceneId: target.token?.scene?.id || null,
				actorId: isFromToken ? null : target.id,
			});
		}

		const newHealth = Math.max(0, currentHealth - healAmount);
		const actualHealing = currentHealth - newHealth;

		if (actualHealing <= 0) {
			console.warn(`${target.name} already has no damage to heal`);
			ui.notifications.warn(`${target.name} has no damage to heal.`);
			continue;
		}

		try {
			await target.update({
				'system.health.value': newHealth,
			});

			successfulApplications++;
			results.push({
				target: target,
				actualHealing: actualHealing,
				newHealth: newHealth,
				maxHealth: maxHealth,
			});
		} catch (error) {
			console.error(`Error applying healing to ${target.name}:`, error);
			ui.notifications.error(`Error applying healing to ${target.name}.`);
		}
	}

	if (successfulApplications === 0) {
		return { success: false, undoId: null };
	}

	if (createUndo && undoRecord && undoRecord.actors.length > 0) {
		undoData.set(undoId, undoRecord);
	}

	await _sendHealingApplicationMessages(results, sourceActor, healAmount, createUndo ? undoId : null);

	const targetNames = results.map(r => r.target.name).join(', ');
	const message = `Applied healing to: ${targetNames}`;
	ui.notifications.info(message);

	return { success: true, undoId: createUndo ? undoId : null };
}

export async function undoDamageHealing(undoId) {
	const record = undoData.get(undoId);
	if (!record) {
		console.error('Undo record not found:', undoId);
		ui.notifications.error('Undo data not found.');
		return false;
	}

	console.log('Daggerheart | Starting undo operation:', undoId, record);

	const targets = [];

	for (const actorData of record.actors) {
		console.log('Daggerheart | Processing undo data for:', actorData);

		let targetActor = null;

		if (actorData.isFromToken) {
			let token = null;
			if (actorData.tokenId && actorData.sceneId) {
				const scene = game.scenes.get(actorData.sceneId);
				if (scene && scene.id === canvas.scene?.id) {
					token = canvas.tokens?.placeables.find(t => t.id === actorData.tokenId);
				}
			}

			if (!token && actorData.actorId) {
				const tokens = canvas.tokens?.placeables || [];
				token = tokens.find(t => t.actor && t.actor.id === actorData.actorId);
			}

			if (!token) {
				console.warn(
					`Damage Application Undo: Searching for token by name "${actorData.actorName}" is DEPRECATED. Actor names are not unique and may cause issues.`
				);
				const tokens = canvas.tokens?.placeables || [];
				token = tokens.find(
					t => t.actor && t.actor.name === actorData.actorName && t.actor.type === actorData.actorType
				);
			}

			if (token && token.actor) {
				targetActor = token.actor;
				console.log('Daggerheart | Found token actor in current scene:', targetActor.name);
			} else {
				console.warn(`Token actor ${actorData.actorName} not found in current scene`);
				continue;
			}
		} else {
			targetActor = game.actors.get(actorData.actorId);
			if (targetActor) {
				console.log('Daggerheart | Found world actor:', targetActor.name);
			} else {
				console.warn(`World actor with ID ${actorData.actorId} not found`);
				continue;
			}
		}

		if (targetActor) {
			const currentHealth = parseInt(targetActor.system.health?.value) || 0;
			const targetHealth = actorData.originalHealth;
			const healthDifference = currentHealth - targetHealth;

			let armorData = null;
			if (actorData.originalArmorSlots !== undefined && actorData.armorSlotsApplied !== undefined) {
				const currentArmorSlots = parseInt(targetActor.system.defenses?.['armor-slots']?.value) || 0;
				armorData = {
					current: currentArmorSlots,
					original: actorData.originalArmorSlots,
					applied: actorData.armorSlotsApplied,
				};
			}

			console.log('Daggerheart | Health analysis:', {
				actorName: targetActor.name,
				currentHealth: currentHealth,
				targetHealth: targetHealth,
				difference: healthDifference,
				armorData: armorData,
			});

			targets.push({
				actor: targetActor,
				originalHealth: targetHealth,
				currentHealth: currentHealth,
				healthDifference: healthDifference,
				armorData: armorData,
			});
		}
	}

	if (targets.length === 0) {
		ui.notifications.warn('No targets found for undo operation.');
		return false;
	}

	let successfulUndos = 0;
	const results = [];

	for (const targetData of targets) {
		const { actor, originalHealth, currentHealth, healthDifference, armorData } = targetData;

		try {
			const updateData = {};
			let needsUpdate = false;

			if (healthDifference > 0) {
				console.log(`Daggerheart | Healing ${actor.name} by ${healthDifference} to restore to ${originalHealth}`);
				const healResult = await applyHealing([actor], healthDifference, null, false);
				if (healResult.success) {
					successfulUndos++;
					results.push({ actor: actor, restoredHealth: originalHealth });
				}
			} else if (healthDifference < 0) {
				const damageAmount = Math.abs(healthDifference);
				console.log(`Daggerheart | Damaging ${actor.name} by ${damageAmount} to restore to ${originalHealth}`);

				if (record.type === 'direct_damage' || record.type === 'healing') {
					const damageResult = await applyDirectDamage([actor], damageAmount, null, false);
					if (damageResult.success) {
						successfulUndos++;
						results.push({ actor: actor, restoredHealth: originalHealth });
					}
				} else {
					const damageResult = await applyDamage([actor], damageAmount, null, false, 0);
					if (damageResult.success) {
						successfulUndos++;
						results.push({ actor: actor, restoredHealth: originalHealth });
					}
				}
			} else {
				console.log(`Daggerheart | ${actor.name} already at target health ${originalHealth}`);
				successfulUndos++;
				results.push({ actor: actor, restoredHealth: originalHealth });
			}

			if (armorData && armorData.applied > 0) {
				console.log(
					`Daggerheart | Restoring ${actor.name} armor slots from ${armorData.current} to ${armorData.original}`
				);
				updateData['system.defenses.armor-slots.value'] = armorData.original;
				needsUpdate = true;
			}

			if (needsUpdate) {
				await actor.update(updateData);
				console.log(`Daggerheart | Restored armor slots for ${actor.name}`);
			}
		} catch (error) {
			console.error(`Error undoing changes for ${actor.name}:`, error);
			ui.notifications.error(`Error undoing changes for ${actor.name}.`);
		}
	}

	console.log('Daggerheart | Undo operation completed:', {
		successfulUndos,
		totalTargets: targets.length,
	});

	if (successfulUndos > 0) {
		undoData.delete(undoId);

		await _sendUndoMessage(record, results);

		const targetNames = results.map(r => r.actor.name).join(', ');
		let actionType = 'damage';
		if (record.type === 'healing') {
			actionType = 'healing';
		} else if (record.type === 'direct_damage') {
			actionType = 'direct damage';
		}
		ui.notifications.info(`Undid ${actionType} for: ${targetNames}`);

		return true;
	}

	return false;
}

function _getTargetActors() {
	const actors = [];

	const targets = Array.from(game.user.targets);
	if (targets.length > 0) {
		for (const token of targets) {
			if (!token.actor) {
				throw new Error('One or more targeted tokens have no associated actor.');
			}

			const actorWrapper = Object.create(token.actor);
			actorWrapper._sourceToken = token;

			Object.defineProperty(actorWrapper, 'token', {
				get: function () {
					return this._sourceToken;
				},
				enumerable: true,
				configurable: true,
			});
			actors.push(actorWrapper);
		}
		return actors;
	}

	const controlled = canvas.tokens?.controlled || [];
	if (controlled.length > 0) {
		for (const token of controlled) {
			if (!token.actor) {
				throw new Error('One or more selected tokens have no associated actor.');
			}

			const actorWrapper = Object.create(token.actor);
			actorWrapper._sourceToken = token;

			Object.defineProperty(actorWrapper, 'token', {
				get: function () {
					return this._sourceToken;
				},
				enumerable: true,
				configurable: true,
			});
			actors.push(actorWrapper);
		}
		return actors;
	}

	throw new Error('No tokens targeted or selected. Please target or select one or more tokens.');
}

function _calculateDamageToHP(damageAmount, thresholds) {
	const severeThreshold = parseInt(thresholds.severe?.value ?? thresholds.severe) || 0;
	const majorThreshold = parseInt(thresholds.major?.value ?? thresholds.major) || 0;

	if (severeThreshold === 0 || (severeThreshold > 0 && damageAmount >= severeThreshold)) {
		return 3;
	}

	if (majorThreshold === 0 || (majorThreshold > 0 && damageAmount >= majorThreshold)) {
		return 2;
	}

	return 1;
}

function _getAvailableModifiers(actor, weaponSlot = null) {
	const modifiers = [];

	if (!actor) return modifiers;

	// Get modifiers from the modifier system (always include these)
	if (actor.system?.modifiers) {
		Object.entries(actor.system.modifiers).forEach(([key, modifier]) => {
			if (modifier.active && modifier.type === 'damage') {
				modifiers.push({
					name: modifier.name || 'Damage Modifier',
					formula: modifier.value || '+1',
					enabled: false,
					source: 'modifier',
					id: modifier.id || key,
				});
			}
		});
	}

	// Get modifiers from specific weapon slot only
	if (actor.system && weaponSlot) {
		const weaponData = actor.system[weaponSlot];
		if (weaponData?.damage) {
			// Regular damage modifiers
			if (weaponData.damage.modifiers) {
				weaponData.damage.modifiers.forEach(mod => {
					modifiers.push({
						name: mod.name || 'Damage Modifier',
						formula: mod.value || '+1',
						enabled: mod.enabled !== false,
						source: weaponSlot,
						id: mod.id,
					});
				});
			}

			// Permanent damage modifiers
			if (weaponData.damage.permanentModifiers) {
				weaponData.damage.permanentModifiers.forEach(mod => {
					modifiers.push({
						name: mod.name || 'Permanent Damage Modifier',
						formula: mod.value || '+1',
						enabled: true, // Permanent modifiers are always enabled
						source: `${weaponSlot}-permanent`,
						id: mod.id,
						permanent: true,
					});
				});
			}
		}
	}

	// Get modifiers from equipped items with damage modifiers (always include these)
	if (actor.items) {
		actor.items.forEach(item => {
			if (item.system?.equipped && item.system?.damageModifiers) {
				item.system.damageModifiers.forEach(mod => {
					if (mod.active) {
						modifiers.push({
							name: `${item.name}: ${mod.name}`,
							formula: mod.formula || '+1',
							enabled: false,
							source: 'equipment',
							id: mod.id || `${item.id}_${mod.name}`,
						});
					}
				});
			}
		});
	}

	// Get temporary modifiers from effects (always include these)
	if (actor.effects) {
		actor.effects.forEach(effect => {
			if (!effect.disabled && effect.changes) {
				effect.changes.forEach(change => {
					if (change.key.includes('damage')) {
						modifiers.push({
							name: `${effect.name}: Damage`,
							formula: change.value || '+1',
							enabled: false,
							source: 'effect',
							id: `${effect.id}_${change.key}`,
						});
					}
				});
			}
		});
	}

	return modifiers;
}

function _getThresholdDescription(damageAmount, thresholds, hpDamage) {
	const severeThreshold = parseInt(thresholds.severe?.value ?? thresholds.severe) || 0;
	const majorThreshold = parseInt(thresholds.major?.value ?? thresholds.major) || 0;

	if (hpDamage === 3) {
		if (severeThreshold === 0) {
			return `Always Severe Damage (Severe Threshold: 0) = 3 HP`;
		} else {
			return `${damageAmount} ≥ ${severeThreshold} (Severe Threshold) = 3 HP`;
		}
	} else if (hpDamage === 2) {
		if (majorThreshold === 0) {
			return `Always Major+ Damage (Major Threshold: 0) = 2 HP`;
		} else {
			return `${damageAmount} ≥ ${majorThreshold} (Major Threshold) = 2 HP`;
		}
	} else {
		if (majorThreshold === 0) {
			return `${damageAmount} (Minor Damage) = 1 HP`;
		} else {
			return `${damageAmount} < ${majorThreshold} (Minor Threshold) = 1 HP`;
		}
	}
}

export function extractRollTotal(message) {
	try {
		if (message.rolls && message.rolls.length > 0) {
			return message.rolls[0].total;
		}
		return null;
	} catch (error) {
		console.error('Error extracting roll total:', error);
		return null;
	}
}

export async function rollDamageWithDialog(formula, options = {}) {
	console.log('Daggerheart | rollDamageWithDialog called with:', { formula, options });

	try {
		const defaults = {
			sourceActor: null,
			weaponName: null,
			weaponType: null,
			weaponSlot: null, // Add weapon slot to determine which weapon's modifiers to show
			isCritical: false,
			damageModifiers: [],
			availableModifiers: [],
			targetActorIds: null,
		};

		const config = { ...defaults, ...options };

		if (!config.targetActorIds) {
			const targets = Array.from(game.user?.targets || []);
			config.targetActorIds = targets.map(t => t.actor?.id).filter(id => !!id);
		}

		// Get available modifiers from the source actor for the specific weapon slot
		const availableModifiers = config.sourceActor ? _getAvailableModifiers(config.sourceActor, config.weaponSlot) : [];

		console.log('Daggerheart | Showing damage dialog with config:', {
			title: config.weaponName ? `${config.weaponName} Damage` : 'Damage Roll',
			formula,
			sourceActor: config.sourceActor?.name,
			weaponName: config.weaponName,
			weaponType: config.weaponType,
			weaponSlot: config.weaponSlot,
			isCritical: config.isCritical,
			damageModifiers: config.damageModifiers,
			availableModifiers: [...availableModifiers, ...config.availableModifiers],
		});

		// Show the damage roll dialog
		const result = await DamageRollDialog.show({
			title: config.weaponName ? `${config.weaponName} Damage` : 'Damage Roll',
			formula,
			sourceActor: config.sourceActor,
			weaponName: config.weaponName,
			weaponType: config.weaponType,
			weaponSlot: config.weaponSlot,
			isCritical: config.isCritical,
			damageModifiers: config.damageModifiers,
			availableModifiers: [...availableModifiers, ...config.availableModifiers],
			targetActorIds: config.targetActorIds,
		});

		console.log('Daggerheart | Damage dialog result:', result);
		return result;
	} catch (error) {
		console.error('Daggerheart | Error in rollDamageWithDialog:', error);
		ui.notifications.error('Failed to show damage dialog. Check console for details.');
		throw error;
	}
}

export async function rollDamage(formula, options = {}) {
	const defaults = {
		sourceActor: null,
		flavor: null,
		sendToChat: true,
		returnRoll: false,
		weaponName: null,
		weaponType: null,
		isCritical: false,
		damageData: null,
		proficiency: null,
		source: 'manual',
		showDialog: false,
		targetActorIds: null,
	};

	const config = { ...defaults, ...options };

	// If showDialog is true, use the dialog version
	if (config.showDialog) {
		return await rollDamageWithDialog(formula, config);
	}

	let finalFormula = formula;

	if (config.damageData && config.sourceActor) {
		const actorType = config.sourceActor.type;
		if (actorType === 'character') {
			const proficiency =
				config.proficiency || Math.max(1, parseInt(config.sourceActor.system.proficiency?.value) || 1);
			finalFormula = _buildConsolidatedCharacterDamageFormula(config.damageData, proficiency, config.isCritical);
		} else if (actorType === 'npc' || actorType === 'companion') {
			finalFormula = _buildConsolidatedAdversaryDamageFormula(config.damageData, config.isCritical);
		}
	}

	if (!finalFormula || typeof finalFormula !== 'string') {
		console.error('Damage roll requires a valid dice formula');
		ui.notifications.error('Damage roll requires a valid dice formula.');
		return null;
	}

	let roll;
	try {
		const rollData = config.sourceActor ? config.sourceActor.getRollData() : {};
		roll = new Roll(finalFormula, rollData);
		await roll.evaluate();
	} catch (error) {
		console.error('Invalid damage roll formula:', error);
		ui.notifications.error('Invalid damage roll formula.');
		return null;
	}

	if (config.sendToChat) {
		const flavorText = config.flavor || `<p class="roll-flavor-line"><b>Damage Roll</b></p>`;

		try {
			const chatMessage = await ChatMessage.create({
				flavor: flavorText,
				user: game.user.id,
				speaker: config.sourceActor ? ChatMessage.getSpeaker({ actor: config.sourceActor }) : ChatMessage.getSpeaker(),
				type: CONST.CHAT_MESSAGE_TYPES.ROLL,
				rolls: [roll],
				rollMode: 'roll',
				flags: {
					'uo-msg': {
						rollType: 'damage',
						actorId: config.sourceActor?.id || null,
						actorType: config.sourceActor?.type || null,
						damageAmount: roll.total,
						isManualRoll: true,
						targetActorIds: Array.isArray(config.targetActorIds)
							? config.targetActorIds
							: Array.from(game.user?.targets || [])
									.map(t => t.actor?.id)
									.filter(id => !!id),
					},
				},
			});

			if (chatMessage?.id && game.dice3d) {
				await game.dice3d.waitFor3DAnimationByMessageID(chatMessage.id);
			}
		} catch (error) {
			console.error('Error creating damage roll chat message:', error);
			ui.notifications.warn('Chat message failed to send, but damage was rolled.');
		}
	}

	if (config.returnRoll) {
		return roll;
	}

	return {
		total: roll.total,
		formula: roll.formula,
		roll: roll,
	};
}

export async function rollHealing(formula, options = {}) {
	const defaults = {
		sourceActor: null,
		flavor: null,
		sendToChat: true,
		returnRoll: false,
	};

	const config = { ...defaults, ...options };

	if (!formula || typeof formula !== 'string') {
		console.error('Healing roll requires a valid dice formula');
		ui.notifications.error('Healing roll requires a valid dice formula.');
		return null;
	}

	let roll;
	try {
		const rollData = config.sourceActor ? config.sourceActor.getRollData() : {};
		roll = new Roll(formula, rollData);
		await roll.evaluate();
	} catch (error) {
		console.error('Invalid healing roll formula:', error);
		ui.notifications.error('Invalid healing roll formula.');
		return null;
	}

	if (config.sendToChat) {
		const flavorText = config.flavor || `<p class="roll-flavor-line"><b>Healing Roll</b></p>`;

		try {
			const chatMessage = await ChatMessage.create({
				flavor: flavorText,
				user: game.user.id,
				speaker: config.sourceActor ? ChatMessage.getSpeaker({ actor: config.sourceActor }) : ChatMessage.getSpeaker(),
				type: CONST.CHAT_MESSAGE_TYPES.ROLL,
				rolls: [roll],
				rollMode: 'roll',
				flags: {
					'uo-msg': {
						rollType: 'healing',
						actorId: config.sourceActor?.id || null,
						actorType: config.sourceActor?.type || null,
						healingAmount: roll.total,
						isManualRoll: true,
					},
				},
			});

			if (chatMessage?.id && game.dice3d) {
				await game.dice3d.waitFor3DAnimationByMessageID(chatMessage.id);
			}
		} catch (error) {
			console.error('Error creating healing roll chat message:', error);
			ui.notifications.warn('Chat message failed to send, but healing was rolled.');
		}
	}

	if (config.returnRoll) {
		return roll;
	}

	return {
		total: roll.total,
		formula: roll.formula,
		roll: roll,
	};
}

async function _sendDirectDamageApplicationMessages(results, sourceActor, hpDamage, undoId) {
	for (const result of results) {
		const { target, actualDamage, newHealth, maxHealth } = result;

		const isDead = newHealth >= maxHealth;

		const publicContent = `<div class="damage-application-message">
      <h3><i class="fas fa-sword"></i> Direct Damage Applied</h3>
      <p><strong>${target.name}</strong> takes <strong>${actualDamage} HP damage</strong>${sourceActor ? ` from <strong>${sourceActor.name}</strong>` : ''}.</p>
      <p>Current damage: <strong>${newHealth}/${maxHealth}</strong></p>
      ${isDead ? '<p class="damage-warning"><em>Character has fallen!</em></p>' : ''}
      ${
				undoId
					? `<div class="damage-undo-container" style="margin-top: 0.5em;">
        <button class="undo-damage-button" data-undo-id="${undoId}" style="width: 100%;">
          <i class="fas fa-undo"></i> Undo
        </button>
      </div>`
					: ''
			}
    </div>`;

		await ChatMessage.create({
			user: game.user.id,
			speaker: sourceActor ? ChatMessage.getSpeaker({ actor: sourceActor }) : ChatMessage.getSpeaker(),
			content: publicContent,
			flags: {
				'uo-msg': {
					messageType: 'directDamageApplied',
					targetActorId: target.id,
					sourceActorId: sourceActor?.id || null,
					hpDamage: actualDamage,
					currentHealth: newHealth,
					maxHealth: maxHealth,
					undoId: undoId,
				},
			},
		});
	}
}

async function _sendDamageApplicationMessages(results, sourceActor, damageAmount, undoId) {
	for (const result of results) {
		const { target, hpDamage, finalHpDamage, armorSlotsUsed, newHealth, maxHealth, thresholds } = result;

		let severityText = '';
		let severityIcon = 'fas fa-sword';

		if (hpDamage >= 3) {
			severityText = 'Severe Damage Applied';
			severityIcon = 'fas fa-skull-crossbones';
		} else if (hpDamage >= 2) {
			severityText = 'Major Damage Applied';
			severityIcon = 'fas fa-sword';
		} else {
			severityText = 'Minor Damage Applied';
			severityIcon = 'fas fa-sword';
		}

		let armorReductionText = '';
		if (armorSlotsUsed > 0) {
			const damageReduction = hpDamage - finalHpDamage;
			if (damageReduction > 0) {
				armorReductionText = ` (reduced by ${armorSlotsUsed} armor)`;
			}
		}

		const publicContent = `<div class="damage-application-message">
      <h3><i class="${severityIcon}"></i> ${severityText}</h3>
      <p><strong>${target.name}</strong> takes <strong>${finalHpDamage} HP damage</strong>${armorReductionText}${sourceActor ? ` from <strong>${sourceActor.name}</strong>` : ''}.</p>
      ${
				undoId
					? `<div class="damage-undo-container" style="margin-top: 0.5em;">
        <button class="undo-damage-button" data-undo-id="${undoId}" style="width: 100%;">
          <i class="fas fa-undo"></i> Undo
        </button>
      </div>`
					: ''
			}
    </div>`;

		await ChatMessage.create({
			user: game.user.id,
			speaker: sourceActor ? ChatMessage.getSpeaker({ actor: sourceActor }) : ChatMessage.getSpeaker(),
			content: publicContent,
			flags: {
				'uo-msg': {
					messageType: 'damageApplied',
					targetActorId: target.id,
					sourceActorId: sourceActor?.id || null,
					damageRoll: damageAmount,
					hpDamage: finalHpDamage,
					currentHealth: newHealth,
					maxHealth: maxHealth,
					undoId: undoId,
				},
			},
		});

		const detailedThresholdInfo = _getThresholdDescription(damageAmount, thresholds, hpDamage);
		const gmContent = `<div class="damage-gm-info">
      <h4><i class="fas fa-eye"></i> GM Info: ${target.name}</h4>
      <p><strong>Threshold Calculation:</strong> ${detailedThresholdInfo}</p>
      ${armorSlotsUsed > 0 ? `<p><strong>Armor Reduction:</strong> ${hpDamage} HP - ${armorSlotsUsed} armor = ${finalHpDamage} HP final</p>` : ''}
      <p><strong>Current Damage:</strong> ${newHealth}/${maxHealth}</p>
    </div>`;

		await ChatMessage.create({
			user: game.user.id,
			speaker: sourceActor ? ChatMessage.getSpeaker({ actor: sourceActor }) : ChatMessage.getSpeaker(),
			content: gmContent,
			whisper: ChatMessage.getWhisperRecipients('GM'),
			flags: {
				'uo-msg': {
					messageType: 'damageGMInfo',
					targetActorId: target.id,
					sourceActorId: sourceActor?.id || null,
				},
			},
		});
	}
}

async function _sendHealingApplicationMessages(results, sourceActor, healAmount, undoId) {
	for (const result of results) {
		const { target, actualHealing, newHealth, maxHealth } = result;

		const chatContent = `<div class="healing-application-message">
      <h3><i class="fas fa-heart"></i> Healing Applied</h3>
      <p><strong>${target.name}</strong> heals <strong>${actualHealing} HP</strong>${sourceActor ? ` from <strong>${sourceActor.name}</strong>` : ''}.</p>
      <p>Current damage: <strong>${newHealth}/${maxHealth}</strong></p>
      ${newHealth === 0 ? '<p class="healing-success"><em>Fully healed!</em></p>' : ''}
      ${
				undoId
					? `<div class="healing-undo-container" style="margin-top: 0.5em;">
        <button class="undo-healing-button" data-undo-id="${undoId}" style="width: 100%;">
          <i class="fas fa-undo"></i> Undo
        </button>
      </div>`
					: ''
			}
    </div>`;

		await ChatMessage.create({
			user: game.user.id,
			speaker: sourceActor ? ChatMessage.getSpeaker({ actor: sourceActor }) : ChatMessage.getSpeaker(),
			content: chatContent,
			flags: {
				'uo-msg': {
					messageType: 'healingApplied',
					targetActorId: target.id,
					sourceActorId: sourceActor?.id || null,
					healingRoll: healAmount,
					hpHealed: actualHealing,
					currentHealth: newHealth,
					maxHealth: maxHealth,
					undoId: undoId,
				},
			},
		});

		const gmContent = `<div class="healing-gm-info">
      <h4><i class="fas fa-eye"></i> GM Info: ${target.name}</h4>
      <p><strong>Current Damage:</strong> ${newHealth}/${maxHealth}</p>
    </div>`;

		await ChatMessage.create({
			user: game.user.id,
			speaker: sourceActor ? ChatMessage.getSpeaker({ actor: sourceActor }) : ChatMessage.getSpeaker(),
			content: gmContent,
			whisper: ChatMessage.getWhisperRecipients('GM'),
			flags: {
				'uo-msg': {
					messageType: 'healingGMInfo',
					targetActorId: target.id,
					sourceActorId: sourceActor?.id || null,
				},
			},
		});
	}
}

async function _sendUndoMessage(record, results) {
	let actionType = 'damage';
	if (record.type === 'healing') {
		actionType = 'healing';
	} else if (record.type === 'direct_damage') {
		actionType = 'direct damage';
	}
	const targetNames = results.map(r => r.actor.name).join(', ');

	const chatContent = `<div class="undo-message">
    <h3><i class="fas fa-undo"></i> ${actionType.charAt(0).toUpperCase() + actionType.slice(1)} Undone</h3>
    <p>Reverted ${actionType} application for: <strong>${targetNames}</strong></p>
    <div class="undo-details">
      <p><em>Health values restored to previous state.</em></p>
    </div>
  </div>`;

	await ChatMessage.create({
		user: game.user.id,
		speaker: ChatMessage.getSpeaker(),
		content: chatContent,
		flags: {
			'uo-msg': {
				messageType: 'undoApplied',
				undoType: record.type,
				actorCount: results.length,
			},
		},
	});
}

export function getActorArmorSlots(actor) {
	if (!actor || actor.type !== 'character') {
		return { current: 0, max: 0, available: 0 };
	}

	const current = parseInt(actor.system.defenses?.['armor-slots']?.value) || 0;
	const max = parseInt(actor.system.defenses?.['armor-slots']?.max) || 0;
	const available = max - current;

	return { current, max, available };
}

export function canUseArmorSlots(actor) {
	if (!actor || actor.type !== 'character') {
		return false;
	}

	const armorSlots = getActorArmorSlots(actor);
	return armorSlots.available > 0;
}

export function debugUndoData(undoId) {
	const record = undoData.get(undoId);
	if (!record) {
		console.error('Debug: Undo record not found:', undoId);
		return;
	}

	console.log('Debug: Undo record analysis:', record);

	for (const actorData of record.actors) {
		console.log('Debug: Actor data:', actorData);

		const worldActor = game.actors.get(actorData.actorId);
		console.log('Debug: World actor found:', !!worldActor, worldActor?.name);

		if (actorData.sceneId && actorData.tokenId) {
			const scene = game.scenes.get(actorData.sceneId);
			const token = scene?.tokens.get(actorData.tokenId);
			console.log('Debug: Scene token found:', !!token, token?.actor?.name);
		}

		const currentTokens = canvas.tokens?.placeables || [];
		const currentToken = currentTokens.find(t => t.actor?.id === actorData.actorId);
		console.log('Debug: Current scene token found:', !!currentToken, currentToken?.actor?.name);
	}
}

function _buildConsolidatedCharacterDamageFormula(damageData, proficiency, isCritical) {
	let baseFormula = damageData.baseValue || '1d8';

	const diceMatch = baseFormula.match(/^(\d*)d(\d+)(.*)$/i);
	if (diceMatch) {
		const diceCount = diceMatch[1] === '' || diceMatch[1] === '1' ? proficiency : parseInt(diceMatch[1]);
		const dieType = parseInt(diceMatch[2]);
		const remainder = diceMatch[3] || '';
		baseFormula = `${diceCount}d${dieType}${remainder}`;
	}

	const modifiers = damageData.modifiers || [];
	const enabledModifiers = modifiers.filter(mod => mod.enabled !== false && mod.value);

	let formula = baseFormula;
	enabledModifiers.forEach(modifier => {
		let modValue = modifier.value.trim();

		if (modValue && !modValue.startsWith('+') && !modValue.startsWith('-')) {
			modValue = '+' + modValue;
		}
		formula += ' ' + modValue;
	});

	if (isCritical && diceMatch) {
		const diceCount = parseInt(diceMatch[1]) || proficiency;
		const dieType = parseInt(diceMatch[2]);
		const maxDamage = diceCount * dieType;

		let criticalFormula = `${maxDamage} + ${formula}`;
		return criticalFormula;
	}

	return formula;
}

function _buildConsolidatedAdversaryDamageFormula(damageData, isCritical) {
	let baseFormula = damageData.baseValue || '1d8';

	const modifiers = damageData.modifiers || [];
	const enabledModifiers = modifiers.filter(mod => mod.enabled !== false && mod.value);

	let formula = baseFormula;
	enabledModifiers.forEach(modifier => {
		let modValue = modifier.value.trim();

		if (modValue && !modValue.startsWith('+') && !modValue.startsWith('-')) {
			modValue = '+' + modValue;
		}
		formula += ' ' + modValue;
	});

	if (isCritical) {
		return _calculateConsolidatedAdversaryCriticalDamage(formula);
	}

	return formula;
}

function _calculateConsolidatedAdversaryCriticalDamage(damageFormula) {
	const dicePattern = /(\d*)d(\d+)/gi;
	let criticalFormula = damageFormula;
	let maxDamageTotal = 0;

	criticalFormula = criticalFormula.replace(dicePattern, (match, count, sides) => {
		const diceCount = parseInt(count) || 1;
		const dieSides = parseInt(sides);
		const maxValue = diceCount * dieSides;
		maxDamageTotal += maxValue;
		return match;
	});

	if (maxDamageTotal > 0) {
		return `${maxDamageTotal} + ${damageFormula}`;
	} else {
		return damageFormula;
	}
}
