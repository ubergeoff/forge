import { computed, signal } from "/vorra/vorra.js";
//#region ../packages/forms/dist/control.js
/**
* Creates a signal-based form control for a single field.
*
* @example
* const name = formControl('', [Validators.required, Validators.minLength(2)]);
*
* name.value()    // '' (reactive)
* name.valid()    // false — required validator fails
* name.errors()   // { required: true }
*
* name.setValue('Alice');
* name.valid()    // true
*/
function formControl(initialValue, validators = [], asyncValidators = []) {
	const _value = signal(initialValue);
	const _touched = signal(false);
	const _dirty = signal(false);
	const _disabled = signal(false);
	const _validators = signal(validators);
	const _asyncErrors = signal(null);
	const _pending = signal(false);
	const syncErrors = computed(() => {
		const vals = _validators();
		if (vals.length === 0) return null;
		let combined = null;
		for (const v of vals) {
			const err = v(_value());
			if (err !== null) {
				combined ??= {};
				Object.assign(combined, err);
			}
		}
		return combined;
	});
	const errors = computed(() => {
		if (_disabled()) return null;
		const se = syncErrors();
		const ae = _asyncErrors();
		if (se === null && ae === null) return null;
		return {
			...se ?? {},
			...ae ?? {}
		};
	});
	const status = computed(() => {
		if (_disabled()) return "DISABLED";
		if (_pending()) return "PENDING";
		if (errors() !== null) return "INVALID";
		return "VALID";
	});
	function runAsync(value) {
		if (asyncValidators.length === 0) return;
		_pending.set(true);
		Promise.all(asyncValidators.map((v) => v(value))).then((results) => {
			let combined = null;
			for (const err of results) if (err !== null) {
				combined ??= {};
				Object.assign(combined, err);
			}
			_asyncErrors.set(combined);
			_pending.set(false);
		}).catch(() => {
			_pending.set(false);
		});
	}
	runAsync(initialValue);
	return {
		value: _value.asReadonly(),
		valid: computed(() => status() === "VALID"),
		invalid: computed(() => status() === "INVALID"),
		pending: computed(() => status() === "PENDING"),
		disabled: computed(() => _disabled()),
		enabled: computed(() => !_disabled()),
		errors,
		status,
		touched: _touched.asReadonly(),
		untouched: computed(() => !_touched()),
		dirty: _dirty.asReadonly(),
		pristine: computed(() => !_dirty()),
		setValue(value) {
			_value.set(value);
			_dirty.set(true);
			runAsync(value);
		},
		patchValue(value) {
			this.setValue(value);
		},
		reset(value) {
			const v = value !== void 0 ? value : initialValue;
			_value.set(v);
			_touched.set(false);
			_dirty.set(false);
			_asyncErrors.set(null);
			_pending.set(false);
			runAsync(v);
		},
		markAsTouched() {
			_touched.set(true);
		},
		markAsUntouched() {
			_touched.set(false);
		},
		markAsDirty() {
			_dirty.set(true);
		},
		markAsPristine() {
			_dirty.set(false);
		},
		disable() {
			_disabled.set(true);
		},
		enable() {
			_disabled.set(false);
		},
		setValidators(v) {
			_validators.set([...v]);
		},
		addValidators(v) {
			_validators.update((cur) => [...cur, ...v]);
		},
		clearValidators() {
			_validators.set([]);
		}
	};
}
//#endregion
//#region ../packages/forms/dist/group.js
/**
* Creates a signal-based form group that aggregates named child controls.
*
* @example
* const form = formGroup({
*   name: formControl('', [Validators.required]),
*   email: formControl('', [Validators.required, Validators.email]),
* });
*
* form.value()  // { name: '', email: '' }
* form.valid()  // false
*
* form.controls.name.setValue('Alice');
* form.controls.email.setValue('alice@example.com');
* form.valid()  // true
*/
function formGroup(controls, validators = []) {
	const _controls = signal({ ...controls });
	const _validators = signal(validators);
	const value = computed(() => {
		const ctrls = _controls();
		const result = {};
		for (const [k, ctrl] of Object.entries(ctrls)) result[k] = ctrl.value();
		return result;
	});
	const groupErrors = computed(() => {
		const vals = _validators();
		if (vals.length === 0) return null;
		let combined = null;
		for (const v of vals) {
			const err = v(value());
			if (err !== null) {
				combined ??= {};
				Object.assign(combined, err);
			}
		}
		return combined;
	});
	const status = computed(() => {
		const ctrls = Object.values(_controls());
		if (ctrls.some((c) => c.status() === "PENDING")) return "PENDING";
		if (groupErrors() !== null || ctrls.some((c) => c.status() === "INVALID")) return "INVALID";
		if (ctrls.length > 0 && ctrls.every((c) => c.status() === "DISABLED")) return "DISABLED";
		return "VALID";
	});
	return {
		get controls() {
			return _controls();
		},
		value,
		valid: computed(() => status() === "VALID"),
		invalid: computed(() => status() === "INVALID"),
		pending: computed(() => status() === "PENDING"),
		disabled: computed(() => status() === "DISABLED"),
		errors: groupErrors,
		status,
		touched: computed(() => Object.values(_controls()).some((c) => c.touched())),
		dirty: computed(() => Object.values(_controls()).some((c) => c.dirty())),
		setValue(v) {
			const ctrls = _controls();
			for (const [k, val] of Object.entries(v)) ctrls[k]?.setValue(val);
		},
		patchValue(v) {
			const ctrls = _controls();
			for (const [k, val] of Object.entries(v)) if (val !== void 0) ctrls[k]?.setValue(val);
		},
		reset(v) {
			const ctrls = _controls();
			const vals = v;
			for (const [k, ctrl] of Object.entries(ctrls)) ctrl.reset(vals?.[k]);
		},
		markAsTouched() {
			Object.values(_controls()).forEach((c) => c.markAsTouched());
		},
		markAsUntouched() {
			Object.values(_controls()).forEach((c) => c.markAsUntouched());
		},
		markAsDirty() {
			Object.values(_controls()).forEach((c) => c.markAsDirty());
		},
		markAsPristine() {
			Object.values(_controls()).forEach((c) => c.markAsPristine());
		},
		disable() {
			Object.values(_controls()).forEach((c) => c.disable());
		},
		enable() {
			Object.values(_controls()).forEach((c) => c.enable());
		},
		get(name) {
			const ctrl = _controls()[name];
			if (ctrl === void 0) throw new Error(`FormGroup: control '${String(name)}' not found`);
			return ctrl;
		},
		addControl(name, control) {
			_controls.update((c) => ({
				...c,
				[name]: control
			}));
		},
		removeControl(name) {
			_controls.update((c) => {
				const next = { ...c };
				delete next[name];
				return next;
			});
		},
		contains(name) {
			return name in _controls();
		},
		setValidators(v) {
			_validators.set([...v]);
		},
		addValidators(v) {
			_validators.update((cur) => [...cur, ...v]);
		},
		clearValidators() {
			_validators.set([]);
		}
	};
}
//#endregion
//#region ../packages/forms/dist/array.js
/**
* Creates a signal-based form array for a dynamic list of controls.
*
* @example
* const tags = formArray([formControl('typescript'), formControl('forge')]);
*
* tags.value()   // ['typescript', 'forge']
* tags.length()  // 2
*
* tags.push(formControl('signals'));
* tags.value()   // ['typescript', 'forge', 'signals']
*
* tags.removeAt(0);
* tags.value()   // ['forge', 'signals']
*/
function formArray(initialControls = [], validators = []) {
	const _controls = signal([...initialControls]);
	const _validators = signal(validators);
	const value = computed(() => _controls().map((c) => c.value()));
	const arrayErrors = computed(() => {
		const vals = _validators();
		if (vals.length === 0) return null;
		let combined = null;
		for (const v of vals) {
			const err = v(value());
			if (err !== null) {
				combined ??= {};
				Object.assign(combined, err);
			}
		}
		return combined;
	});
	const status = computed(() => {
		const ctrls = _controls();
		if (ctrls.some((c) => c.status() === "PENDING")) return "PENDING";
		if (arrayErrors() !== null || ctrls.some((c) => c.status() === "INVALID")) return "INVALID";
		if (ctrls.length > 0 && ctrls.every((c) => c.status() === "DISABLED")) return "DISABLED";
		return "VALID";
	});
	return {
		controls: computed(() => _controls()),
		value,
		valid: computed(() => status() === "VALID"),
		invalid: computed(() => status() === "INVALID"),
		pending: computed(() => status() === "PENDING"),
		disabled: computed(() => status() === "DISABLED"),
		errors: arrayErrors,
		status,
		touched: computed(() => _controls().some((c) => c.touched())),
		dirty: computed(() => _controls().some((c) => c.dirty())),
		length: computed(() => _controls().length),
		at(index) {
			const ctrl = _controls()[index];
			if (ctrl === void 0) throw new RangeError(`FormArray: index ${index} is out of bounds`);
			return ctrl;
		},
		push(control) {
			_controls.update((arr) => [...arr, control]);
		},
		insert(index, control) {
			_controls.update((arr) => {
				const next = [...arr];
				next.splice(index, 0, control);
				return next;
			});
		},
		removeAt(index) {
			_controls.update((arr) => {
				const next = [...arr];
				next.splice(index, 1);
				return next;
			});
		},
		clear() {
			_controls.set([]);
		},
		setValue(values) {
			const ctrls = _controls();
			for (let i = 0; i < values.length; i++) ctrls[i]?.setValue(values[i]);
		},
		patchValue(values) {
			const ctrls = _controls();
			for (let i = 0; i < Math.min(values.length, ctrls.length); i++) ctrls[i]?.setValue(values[i]);
		},
		reset(values) {
			_controls().forEach((ctrl, i) => ctrl.reset(values?.[i]));
		},
		markAsTouched() {
			_controls().forEach((c) => c.markAsTouched());
		},
		markAsUntouched() {
			_controls().forEach((c) => c.markAsUntouched());
		},
		markAsDirty() {
			_controls().forEach((c) => c.markAsDirty());
		},
		markAsPristine() {
			_controls().forEach((c) => c.markAsPristine());
		},
		disable() {
			_controls().forEach((c) => c.disable());
		},
		enable() {
			_controls().forEach((c) => c.enable());
		},
		setValidators(v) {
			_validators.set([...v]);
		},
		addValidators(v) {
			_validators.update((cur) => [...cur, ...v]);
		},
		clearValidators() {
			_validators.set([]);
		}
	};
}
//#endregion
//#region ../packages/forms/dist/validators.js
const Validators = {
	required(value) {
		if (value === null || value === void 0 || value === "") return { required: true };
		return null;
	},
	minLength(min) {
		return (value) => {
			if (value === null || value === void 0 || value === "") return null;
			const actual = String(value).length;
			return actual < min ? { minLength: {
				required: min,
				actual
			} } : null;
		};
	},
	maxLength(max) {
		return (value) => {
			if (value === null || value === void 0 || value === "") return null;
			const actual = String(value).length;
			return actual > max ? { maxLength: {
				required: max,
				actual
			} } : null;
		};
	},
	min(minimum) {
		return (value) => {
			if (value === null || value === void 0 || value === "") return null;
			const actual = Number(value);
			if (isNaN(actual)) return { min: {
				min: minimum,
				actual: value
			} };
			return actual < minimum ? { min: {
				min: minimum,
				actual
			} } : null;
		};
	},
	max(maximum) {
		return (value) => {
			if (value === null || value === void 0 || value === "") return null;
			const actual = Number(value);
			if (isNaN(actual)) return { max: {
				max: maximum,
				actual: value
			} };
			return actual > maximum ? { max: {
				max: maximum,
				actual
			} } : null;
		};
	},
	email(value) {
		if (value === null || value === void 0 || value === "") return null;
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ? null : { email: true };
	},
	pattern(regex) {
		const re = typeof regex === "string" ? new RegExp(`^${regex}$`) : regex;
		return (value) => {
			if (value === null || value === void 0 || value === "") return null;
			return re.test(String(value)) ? null : { pattern: {
				requiredPattern: re.source,
				actual: value
			} };
		};
	}
};
/**
* Composes multiple validators into one. Runs each in order and merges all
* errors into a single object. Returns null if all pass.
*
* @example
* const nameValidator = compose(Validators.required, Validators.minLength(2));
*/
function compose(...validators) {
	return (value) => {
		let combined = null;
		for (const v of validators) {
			const err = v(value);
			if (err !== null) {
				combined ??= {};
				Object.assign(combined, err);
			}
		}
		return combined;
	};
}
//#endregion
export { Validators, compose, formArray, formControl, formGroup };
