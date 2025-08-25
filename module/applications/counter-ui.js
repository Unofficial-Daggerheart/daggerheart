/**
 * A persistent counter UI element that appears above the hotbar
 */
export class CounterUI {
	constructor() {
		this.element = null;
		this.count = 0;
		this.isUpdating = false;
		this.lastKnownCount = 0;
	}

	/**
	 * Initialize the counter UI
	 */
	async initialize() {
		// Get the saved counter value and validate it
		this.count = game.settings.get('daggerheart-unofficial', 'counterValue');

		// Ensure count is a valid number between 0 and 12
		if (isNaN(this.count) || this.count === null || this.count === undefined) {
			this.count = 0;
			await game.settings.set('daggerheart-unofficial', 'counterValue', 0);
		} else {
			this.count = Math.max(0, Math.min(12, parseInt(this.count)));
		}

		this.lastKnownCount = this.count;

		// Render the counter
		await this.render();

		// Listen for setting changes
		Hooks.on('updateSetting', setting => {
			if (setting.key === 'daggerheart-unofficial.counterValue') {
				const parsed = parseInt(setting.value);
				this.count = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(12, parsed));
				this.updateDisplay();

				if (this.count !== this.lastKnownCount) {
					this.triggerFearChangeAnimation();
					this.lastKnownCount = this.count;
				}
			}
		});

		game.socket.on('system.daggerheart-unofficial', data => {
			if (data.type === 'fearChanged' && data.userId !== game.user.id) {
				this.triggerFearChangeAnimation();
			}
		});
	}

	/**
	 * Render the counter UI element
	 */
	async render() {
		// modify permissions
		const canModify = game.user.isGM || game.user.hasRole('ASSISTANT');

		// Create the counter HTML with inline styles for z-index
		// Only include buttons if the user has permission
		const html = `
      <div id="counter-ui" class="faded-ui counter-ui fear-tracker" style="position: relative; z-index: 9999;">
        ${
					canModify
						? `
        <button type="button" class="counter-minus" title="Decrease" style="position: relative; z-index: 10000; pointer-events: all;">
          <i class="fas fa-minus"></i>
        </button>
        `
						: ''
				}
        <div class="counter-display">
          <div class="counter-value">${this.count}</div>
          <div class="counter-label">Fear</div>
        </div>
        ${
					canModify
						? `
        <button type="button" class="counter-plus" title="Increase" style="position: relative; z-index: 10000; pointer-events: all;">
          <i class="fas fa-plus"></i>
        </button>
        `
						: ''
				}
      </div>
    `;

		// Find or create the counters wrapper
		let countersWrapper = document.getElementById('counters-wrapper');
		if (!countersWrapper) {
			// Create wrapper
			const wrapperHtml = '<div id="counters-wrapper" class="counters-wrapper"></div>';

			// Find the ui-bottom element
			const uiBottom = document.getElementById('ui-bottom');
			if (!uiBottom) {
				console.error('Could not find ui-bottom element');
				return;
			}

			// Insert the wrapper before the hotbar
			const hotbar = document.getElementById('hotbar');
			if (hotbar) {
				hotbar.insertAdjacentHTML('beforebegin', wrapperHtml);
			} else {
				uiBottom.insertAdjacentHTML('afterbegin', wrapperHtml);
			}

			countersWrapper = document.getElementById('counters-wrapper');
		}

		// Insert the counter into the wrapper
		countersWrapper.insertAdjacentHTML('beforeend', html);

		// Store reference to the element
		this.element = document.getElementById('counter-ui');

		// Activate listeners with a small delay to ensure DOM is ready
		// Only activate if user can modify
		if (canModify) {
			setTimeout(() => {
				this.activateListeners();
			}, 100);
		}
	}

	/**
	 * Activate event listeners
	 */
	activateListeners() {
		// Add multiple event types to ensure we catch the interaction
		['click', 'mousedown', 'pointerdown'].forEach(eventType => {
			document.body.addEventListener(
				eventType,
				async e => {
					// Check if clicked element is the plus button - use ID selector to be specific
					if (e.target.closest('#counter-ui .counter-plus')) {
						e.preventDefault();
						e.stopPropagation();
						// plus btn
						if (eventType === 'click') {
							// Only process on click to avoid multiple triggers
							await this.increase();
						}
					}
					// Check if clicked element is the minus button - use ID selector to be specific
					else if (e.target.closest('#counter-ui .counter-minus')) {
						e.preventDefault();
						e.stopPropagation();
						// minus btn
						if (eventType === 'click') {
							// Only process on click to avoid multiple triggers
							await this.decrease();
						}
					}
				},
				true
			); // Use capture phase
		});

		// Add right-click/left-click functionality to the counter display itself
		const counterDisplay = document.querySelector('#counter-ui .counter-display');
		if (counterDisplay) {
			// Prevent default context menu on the counter display
			counterDisplay.addEventListener('contextmenu', e => {
				e.preventDefault();
				e.stopPropagation();
			});

			// Handle left-click (increment) and right-click (decrement) on counter display
			counterDisplay.addEventListener('mousedown', async e => {
				e.preventDefault();
				e.stopPropagation();

				if (e.button === 0) {
					// Left click
					await this.increase();
				} else if (e.button === 2) {
					// Right click
					await this.decrease();
				}
			});

			// Add visual feedback for interactivity
			counterDisplay.style.cursor = 'pointer';
			counterDisplay.style.userSelect = 'none';
			counterDisplay.title = 'Left-click to increase, Right-click to decrease';
		}
	}

	/**
	 * Increase the counter
	 */
	async increase() {
		// Check permissions
		if (!game.user.isGM && !game.user.hasRole('ASSISTANT')) {
			console.warn('Only GMs and Assistant GMs can modify the fear counter');
			return;
		}

		// Prevent concurrent operations
		if (this.isUpdating) {
			return;
		}

		// Maximum value is 12
		if (this.count < 12) {
			this.isUpdating = true;
			try {
				const newCount = this.count + 1;
				await game.settings.set('daggerheart-unofficial', 'counterValue', newCount);
				this.count = newCount;
				this.updateDisplay();
			} finally {
				this.isUpdating = false;
			}
		}
	}

	/**
	 * Decrease the counter
	 */
	async decrease() {
		// Check permissions
		if (!game.user.isGM && !game.user.hasRole('ASSISTANT')) {
			console.warn('Only GMs and Assistant GMs can modify the fear counter');
			return;
		}

		// Prevent concurrent operations
		if (this.isUpdating) {
			return;
		}

		// Minimum value is 0
		if (this.count > 0) {
			this.isUpdating = true;
			try {
				const newCount = this.count - 1;
				await game.settings.set('daggerheart-unofficial', 'counterValue', newCount);
				this.count = newCount;
				this.updateDisplay();
			} finally {
				this.isUpdating = false;
			}
		}
	}

	/**
	 * Spend (decrease) the counter by a specified amount
	 * @param {number} amount - The amount of fear to spend
	 */
	async spendFear(amount = 1) {
		// Check if game is paused
		if (game.paused) {
			console.log('Daggerheart | Fear spending skipped - game is paused');
			ui.notifications.info('Fear spending skipped - game is paused');
			return false;
		}

		// Check permissions
		if (!game.user.isGM && !game.user.hasRole('ASSISTANT')) {
			console.warn('Only GMs and Assistant GMs can spend fear');
			ui.notifications.warn('Only GMs and Assistant GMs can spend fear.');
			return false;
		}

		// Validate amount parameter
		if (!Number.isInteger(amount) || amount <= 0) {
			console.warn('Fear amount must be a positive integer');
			ui.notifications.warn('Fear amount must be a positive integer.');
			return false;
		}

		// Prevent concurrent operations
		if (this.isUpdating) {
			return false;
		}

		// Check if we have enough fear to spend
		if (this.count < amount) {
			console.warn(`Cannot spend ${amount} fear. Current fear: ${this.count}`);
			ui.notifications.warn(`Cannot spend ${amount} fear. Current fear: ${this.count}`);
			return false;
		}

		this.isUpdating = true;
		try {
			const newCount = Math.max(0, this.count - amount);
			await game.settings.set('daggerheart-unofficial', 'counterValue', newCount);
			this.count = newCount;
			this.updateDisplay();

			// Success notification
			const message =
				amount === 1
					? `Spent 1 fear. Remaining fear: ${this.count}`
					: `Spent ${amount} fear. Remaining fear: ${this.count}`;
			ui.notifications.info(message);

			// Send to chat
			ChatMessage.create({
				user: game.user.id,
				speaker: ChatMessage.getSpeaker(),
				content: `<div class="fear-spend-message">
          <h3><i class="fas fa-skull"></i> Fear Spent</h3>
          <p>The GM has spent <strong>${amount}</strong> fear.</p>
          <p>Remaining fear: <strong>${this.count}</strong></p>
        </div>`,
				flags: {
					'uo-msg': {
						messageType: 'fearSpent',
						amountSpent: amount,
						remainingFear: this.count,
					},
				},
			});

			return true;
		} catch (error) {
			console.error('Error spending fear:', error);
			ui.notifications.error('Error spending fear. Check console for details.');
			return false;
		} finally {
			this.isUpdating = false;
		}
	}

	/**
	 * Gain (increase) the counter by a specified amount
	 * @param {number} amount - The amount of fear to gain
	 */
	async gainFear(amount = 1) {
		// Check if game is paused
		if (game.paused) {
			console.log('Daggerheart | Fear gain skipped - game is paused');
			ui.notifications.info('Fear gain skipped - game is paused');
			return false;
		}

		// Check permissions
		if (!game.user.isGM && !game.user.hasRole('ASSISTANT')) {
			console.warn('Only GMs and Assistant GMs can gain fear');
			ui.notifications.warn('Only GMs and Assistant GMs can gain fear.');
			return false;
		}

		// Validate amount parameter
		if (!Number.isInteger(amount) || amount <= 0) {
			console.warn('Fear amount must be a positive integer');
			ui.notifications.warn('Fear amount must be a positive integer.');
			return false;
		}

		// Prevent concurrent operations
		if (this.isUpdating) {
			return false;
		}

		// Check if we can add more fear (maximum is 12)
		if (this.count >= 12) {
			console.warn(`Cannot gain fear. Fear is already at maximum (12)`);
			ui.notifications.warn(`Cannot gain fear. Fear is already at maximum.`);
			return false;
		}

		this.isUpdating = true;
		try {
			const newCount = Math.min(12, this.count + amount);
			const actualAmount = newCount - this.count;
			await game.settings.set('daggerheart-unofficial', 'counterValue', newCount);
			this.count = newCount;
			this.updateDisplay();

			// Success notification
			const message =
				actualAmount === 1
					? `Gained 1 fear. Current fear: ${this.count}`
					: `Gained ${actualAmount} fear. Current fear: ${this.count}`;
			ui.notifications.info(message);

			// Send to chat
			ChatMessage.create({
				user: game.user.id,
				speaker: ChatMessage.getSpeaker(),
				content: `<div class="fear-gain-message">
          <h3><i class="fas fa-skull"></i> Fear Gained</h3>
          <p>The GM has gained <strong>${actualAmount}</strong> fear.</p>
          <p>Current fear: <strong>${this.count}</strong></p>
          ${this.count >= 12 ? '<p class="fear-warning"><em>Maximum fear reached!</em></p>' : ''}
        </div>`,
				flags: {
					'uo-msg': {
						messageType: 'fearGained',
						amountGained: actualAmount,
						currentFear: this.count,
					},
				},
			});

			return true;
		} catch (error) {
			console.error('Error gaining fear:', error);
			ui.notifications.error('Error gaining fear. Check console for details.');
			return false;
		} finally {
			this.isUpdating = false;
		}
	}

	/**
	 * Automatically gain fear from game mechanics (bypasses GM check)
	 * @param {number} amount - The amount of fear to gain
	 * @param {string} source - The source of the fear gain (for logging)
	 */
	async autoGainFear(amount = 1, source = 'game mechanics') {
		// Check if game is paused
		if (game.paused) {
			console.log(`Daggerheart | Automatic fear gain from ${source} skipped - game is paused`);
			return false;
		}

		// Validate amount parameter
		if (!Number.isInteger(amount) || amount <= 0) {
			console.warn('Fear amount must be a positive integer');
			return false;
		}

		// Prevent concurrent operations
		if (this.isUpdating) {
			return false;
		}

		// Check if we can add more fear (maximum is 12)
		if (this.count >= 12) {
			console.warn(`Cannot gain fear. Fear is already at maximum (12)`);
			return false;
		}

		this.isUpdating = true;
		try {
			const newCount = Math.min(12, this.count + amount);
			const actualAmount = newCount - this.count;
			await game.settings.set('daggerheart-unofficial', 'counterValue', newCount);
			this.count = newCount;
			this.updateDisplay();

			console.log(`Daggerheart | Automatic fear gain from ${source}: +${actualAmount} (Current: ${this.count})`);

			// Success notification (less intrusive for automatic gains)
			const message =
				actualAmount === 1
					? `GM gained 1 fear from ${source}. Current fear: ${this.count}`
					: `GM gained ${actualAmount} fear from ${source}. Current fear: ${this.count}`;
			ui.notifications.info(message);

			// Send to chat (only if someone other than GM triggered it)
			if (!game.user.isGM) {
				ChatMessage.create({
					user: game.user.id,
					speaker: ChatMessage.getSpeaker(),
					content: `<div class="fear-gain-message">
            <h3><i class="fas fa-skull"></i> Fear Gained</h3>
            <p>The GM has gained <strong>${actualAmount}</strong> fear from <em>${source}</em>.</p>
            <p>Current fear: <strong>${this.count}</strong></p>
            ${this.count >= 12 ? '<p class="fear-warning"><em>Maximum fear reached!</em></p>' : ''}
          </div>`,
					flags: {
						'uo-msg': {
							messageType: 'fearGained',
							amountGained: actualAmount,
							currentFear: this.count,
							source: source,
							automatic: true,
						},
					},
				});
			}

			return true;
		} catch (error) {
			console.error('Error gaining fear automatically:', error);
			return false;
		} finally {
			this.isUpdating = false;
		}
	}

	/**
	 * Update the counter display
	 */
	updateDisplay() {
		if (!this.element) return;
		const valueElement = this.element.querySelector('.counter-value');
		if (valueElement) {
			// Ensure count is valid
			const displayValue = isNaN(this.count) ? 0 : this.count;
			valueElement.textContent = displayValue;
		}
	}

	triggerFearChangeAnimation() {
		if (!this.element) {
			console.warn('Daggerheart | Cannot trigger fear animation - element not found');
			return;
		}

		if (this.element.classList.contains('fear-changed')) {
			console.log('Daggerheart | Animation already playing, extending duration');
			this.extendFearAnimation();
			return;
		}

		console.log('Daggerheart | Triggering fear change animation');

		this.element.style.setProperty('opacity', '1', 'important');
		this.element.classList.add('fear-changed', 'hovered');
		this.addSkullParticles();

		setTimeout(() => {
			if (this.element) {
				this.element.classList.remove('fear-changed', 'hovered');
				this.removeSkullParticles();
				this.element.style.removeProperty('opacity');
				console.log('Daggerheart | Fear animation completed');
			}
		}, 800);

		if (game.user.isGM || game.user.hasRole('ASSISTANT')) {
			game.socket.emit('system.daggerheart-unofficial', {
				type: 'fearChanged',
				userId: game.user.id,
				timestamp: Date.now(),
			});
			console.log('Daggerheart | Emitted fear change socket event');
		}
	}

	extendFearAnimation() {
		if (!this.element) return;

		this.element.classList.remove('fear-changed', 'hovered');
		this.removeSkullParticles();

		setTimeout(() => {
			if (this.element) {
				this.element.style.setProperty('opacity', '1', 'important');
				this.element.classList.add('fear-changed', 'hovered');
				this.addSkullParticles();

				setTimeout(() => {
					if (this.element) {
						this.element.classList.remove('fear-changed', 'hovered');
						this.removeSkullParticles();
						this.element.style.removeProperty('opacity');
						console.log('Daggerheart | Extended fear animation completed');
					}
				}, 800);
			}
		}, 50);
	}

	addSkullParticles() {
		if (!this.element) return;
		const rect = this.element.getBoundingClientRect();
		const width = rect.width;
		const height = rect.height;
		const particleSettings = game.settings.get('daggerheart-unofficial', 'fearParticleSettings') || {};
		const particleCount = Math.max(0, Math.min(50, parseInt(particleSettings.count ?? 8)));
		const smokeEnabled = particleSettings.smoke !== false;
		const iconClass = particleSettings.icon || 'fa-duotone fa-skull';
		const scaleSetting = parseFloat(particleSettings.scale);
		const iconScale = Number.isFinite(scaleSetting) ? Math.max(0.25, Math.min(4, scaleSetting)) : 1;
		const createOrigin = size => {
			const x = Math.random() * width;
			const y = Math.random() * height;
			return { top: y - size / 2, left: x - size / 2 };
		};
		const createVector = () => {
			const angle = Math.random() * 2 * Math.PI;
			const distance = 80 + Math.random() * 100;
			const tx = Math.cos(angle) * distance * 0.6;
			const ty = -distance - 40;
			return { tx, ty };
		};
		const skullParticles = Array.from({ length: particleCount }, (_, i) => ({
			class: `skull-particle-${i + 1}`,
			delay: 0.1 + Math.random() * 0.4,
			size: Math.round((11 + Math.random() * 8) * iconScale),
		}));
		const smokeCount = smokeEnabled ? Math.max(0, Math.min(40, Math.round(particleCount * 0.6))) : 0;
		const smokeParticles = Array.from({ length: smokeCount }, (_, i) => ({
			class: `smoke-particle-${i + 1}`,
			delay: 0.1 + Math.random() * 0.4,
			size: Math.round(12 + Math.random() * 8),
		}));
		skullParticles.forEach(particle => {
			const div = document.createElement('div');
			div.className = particle.class;
			div.style.animationDelay = `${particle.delay}s`;
			div.style.position = 'absolute';
			div.style.zIndex = '10';
			div.style.pointerEvents = 'none';
			const origin = createOrigin(particle.size);
			div.style.top = `${origin.top}px`;
			div.style.left = `${origin.left}px`;
			const vector = createVector();
			div.style.setProperty('--tx', `${vector.tx}px`);
			div.style.setProperty('--ty', `${vector.ty}px`);
			const duration = 1.6 + Math.random() * 0.2;
			div.style.animation = `skullFloat ${duration}s ease-out ${particle.delay}s forwards`;
			const icon = document.createElement('i');
			icon.className = iconClass;
			icon.style.fontSize = `${particle.size}px`;
			icon.style.color = '#3b75c2';
			icon.style.textShadow = '0 0 8px rgba(59, 117, 194, 0.8), 0 0 15px rgba(59, 117, 194, 0.6)';
			div.appendChild(icon);
			this.element.appendChild(div);
		});
		smokeParticles.forEach(particle => {
			const div = document.createElement('div');
			div.className = particle.class;
			div.style.animationDelay = `${particle.delay}s`;
			div.style.position = 'absolute';
			div.style.zIndex = '5';
			div.style.pointerEvents = 'none';
			const origin = createOrigin(particle.size);
			div.style.top = `${origin.top}px`;
			div.style.left = `${origin.left}px`;
			div.style.width = `${particle.size}px`;
			div.style.height = `${particle.size}px`;
			div.style.background = 'radial-gradient(circle, rgba(128, 128, 128, 0.8) 0%, transparent 70%)';
			const vector = createVector();
			div.style.setProperty('--tx', `${vector.tx}px`);
			div.style.setProperty('--ty', `${vector.ty}px`);
			const duration = 1.6 + Math.random() * 0.2;
			div.style.animation = `smokeFloat ${duration}s ease-out ${particle.delay}s forwards`;
			this.element.appendChild(div);
		});
		this.addSkullAnimations();
	}

	removeSkullParticles() {
		if (!this.element) return;

		const particles = this.element.querySelectorAll(
			'.skull-particle-1, .skull-particle-2, .skull-particle-3, .skull-particle-4, .skull-particle-5, .skull-particle-6, .skull-particle-7, .skull-particle-8, .smoke-particle-1, .smoke-particle-2, .smoke-particle-3, .smoke-particle-4, .smoke-particle-5'
		);
		particles.forEach(particle => particle.remove());

		// Remove the injected CSS animations
		const styleElement = document.getElementById('skull-animations');
		if (styleElement) {
			styleElement.remove();
		}
	}

	addSkullAnimations() {
		if (document.getElementById('skull-animations')) return;
		const style = document.createElement('style');
		style.id = 'skull-animations';
		style.textContent = `
      @keyframes skullFloat {
        0% { opacity: 0; transform: translate(0, 0) scale(0.3); }
        15% { opacity: 1; transform: translate(calc(var(--tx) * 0.15), calc(var(--ty) * 0.15)) scale(1.3); }
        40% { opacity: 1; transform: translate(calc(var(--tx) * 0.4), calc(var(--ty) * 0.4)) scale(1.1); }
        70% { opacity: 0.8; transform: translate(calc(var(--tx) * 0.7), calc(var(--ty) * 0.7)) scale(0.9); }
        100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(0.7); }
      }
      @keyframes smokeFloat {
        0% { opacity: 0; transform: translate(0, 0) scale(0.3); }
        20% { opacity: 0.9; transform: translate(calc(var(--tx) * 0.2), calc(var(--ty) * 0.2)) scale(1.2); }
        50% { opacity: 0.7; transform: translate(calc(var(--tx) * 0.5), calc(var(--ty) * 0.5)) scale(1.8); }
        80% { opacity: 0.4; transform: translate(calc(var(--tx) * 0.8), calc(var(--ty) * 0.8)) scale(2.2); }
        100% { opacity: 0; transform: translate(var(--tx), var(--ty)) scale(2.8); }
      }
    `;
		document.head.appendChild(style);
	}
}
