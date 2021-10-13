import { is, List, Map } from "immutable";
import { extend } from "./environment.js";
import { Keyword } from "./keyword.js";
import { print } from "./printer.js";
import { SpecialForms } from "./symbols.js";
import { Var } from "./var.js";

export async function evalForms(forms, env) {
	let acc;
	for (let form of forms) {
		acc = await evalForm(form, env);
	}
	return acc;
}

const TrivialForms = {
	undefined: true,
	boolean: true,
	number: true,
	string: true,
	function: true,
};

export async function evalForm(form, env) {
	if (TrivialForms[typeof form]) {
		return form;
	}
	if (typeof form === "symbol") {
		if (!(form in env)) {
			throw new Error(`${print(form)} is not defined!`);
		}
		return env[form];
	}
	if (form instanceof Keyword) {
		return form;
	}
	if (form instanceof Var) {
		return form;
	}
	if (Map.isMap(form)) {
		return form;
	}
	if (List.isList(form)) {
		let [operator, ...operands] = form;
		let evalSpecialForm = SpecialFormEvals[operator];
		if (evalSpecialForm) {
			return await evalSpecialForm(operands, env);
		}
		operator = await evalForm(operator, env);
		if (List.isList(operator)) {
			operator = operator.get.bind(operator);
		} else if (Map.isMap(operator)) {
			operator = operator.get.bind(operator);
		} else if (operator instanceof Keyword) {
			operator = operator.get.bind(operator);
		} else if (operator instanceof Var) {
			operator = operator.get.bind(operator);
		}
		if (typeof operator !== "function") {
			throw new TypeError(`Expected function or macro: ${print(operator)}!`);
		}
		if (operator.macro) {
			return await evalForm(await operator(...operands), env);
		} else {
			let evaluatedOperands = [];
			let length = operands.length;
			for (let i = 0; i < length; i += 1) {
				let operand = operands[i];
				if (operand === SpecialForms.Ellipsis) {
					evaluatedOperands.push(...(await evalForm(operands[i + 1], env)));
					break;
				}
				evaluatedOperands.push(await evalForm(operand, env));
			}
			return await operator(...evaluatedOperands);
		}
	}
	throw new TypeError(`Illegal form: ${form}!`);
}

const SpecialFormEvals = {
	[SpecialForms.Def]: async ([symbol, definition], env) => {
		if (typeof symbol !== "symbol") {
			throw new TypeError(`Expected a symbol: ${print(symbol)}!`);
		}
		let evaluated = await evalForm(definition, env);
		if (typeof evaluated === "function" && !evaluated.definedName) {
			evaluated.definedName = symbol.description;
		}
		env[symbol] = evaluated;
	},
	[SpecialForms.If]: async ([condition, thenCase, elseCase], env) => {
		if (await evalForm(condition, env)) {
			return await evalForm(thenCase, env);
		} else {
			return await evalForm(elseCase, env);
		}
	},
	[SpecialForms.And]: async ([...conditions], env) => {
		let acc = true;
		for (let condition of conditions) {
			acc = await evalForm(condition, env);
			if (!acc) {
				return acc;
			}
		}
		return acc;
	},
	[SpecialForms.Or]: async ([...conditions], env) => {
		let acc = false;
		for (let condition of conditions) {
			acc = await evalForm(condition, env);
			if (acc) {
				return acc;
			}
		}
		return acc;
	},
	[SpecialForms.Cond]: async ([...conditionPairs], env) => {
		let length = conditionPairs.length;
		for (let i = 0; i + 1 < length; i += 2) {
			let toCompare = conditionPairs[i];
			if (toCompare === Symbol.for("default") || (await (toCompare, env))) {
				return await evalForm(conditionPairs[i + 1], env);
			}
		}
	},
	[SpecialForms.Case]: async ([x, ...casePairs], env) => {
		let evaledX = await evalForm(x, env);
		let length = casePairs.length;
		for (let i = 0; i + 1 < length; i += 2) {
			let toCompare = casePairs[i];
			if (
				toCompare === Symbol.for("default") ||
				is(evaledX, await evalForm(toCompare, env))
			) {
				return await evalForm(casePairs[i + 1], env);
			}
		}
	},
	[SpecialForms.Do]: async (forms, env) => {
		let acc;
		for (let form of forms) {
			acc = await evalForm(form, env);
		}
		return acc;
	},
	[SpecialForms.Fn]: async ([params, ...body], env) => {
		if (!List.isList(params)) {
			throw new TypeError(`Expected list: ${print(params)}!`);
		}
		for (const param of params) {
			if (typeof param !== "symbol") {
				throw new TypeError(`Expected symbol: ${print(param)}!`);
			}
		}
		let length = params.size;
		let anonymous = async (...args) => {
			let subEnv = extend(env);
			for (let i = 0; i < length; i += 1) {
				let param = params.get(i);
				if (param === SpecialForms.Ellipsis) {
					subEnv[params.get(i + 1)] = List(args.slice(i));
					break;
				}
				subEnv[param] = args[i];
			}
			let acc;
			for (let form of body) {
				acc = await evalForm(form, subEnv);
			}
			return acc;
		};
		anonymous.macro = false;
		anonymous.params = params;
		anonymous.body = body;
		return anonymous;
	},
	[SpecialForms.Let]: async (bindings, env) => {
		let body = bindings.pop();
		let subEnv = extend(env);
		let length = bindings.length;
		for (let i = 0; i + 1 < length; i += 2) {
			let symbol = bindings[i];
			let value = bindings[i + 1];
			if (typeof symbol !== "symbol") {
				throw new TypeError(`Expected symbol: ${print(symbol)}!`);
			}
			subEnv[symbol] = await evalForm(value, subEnv);
		}
		return await evalForm(body, subEnv);
	},
	[SpecialForms.Macro]: async (operands, env) => {
		let f = await SpecialFormEvals[SpecialForms.Fn](operands, env);
		f.macro = true;
		return f;
	},
	[SpecialForms.MacroExpand]: async ([operator, ...operands], env) => {
		operator = await evalForm(operator, env);
		if (typeof operator !== "function" || !operator.macro) {
			throw new TypeError(`Expected macro: ${print(operator)}!`);
		}
		return await operator(...operands);
	},
	[SpecialForms.Quote]: async ([quoted]) => {
		return quoted;
	},
	[SpecialForms.QuasiQuote]: async ([quoted], env) => {
		async function quasiQuote(form) {
			if (!List.isList(form)) {
				return form;
			}
			let acc = [];
			for (let subForm of form) {
				if (List.isList(subForm)) {
					let [symbol, body] = subForm;
					if (symbol === SpecialForms.Unquote) {
						acc.push(await evalForm(body, env));
					} else if (symbol === SpecialForms.UnquoteSplice) {
						acc.push(...(await evalForm(body, env)));
					} else {
						acc.push(await quasiQuote(subForm));
					}
				} else {
					acc.push(await quasiQuote(subForm));
				}
			}
			return List(acc);
		}
		return await quasiQuote(quoted);
	},
	[SpecialForms.Reduced]: async ([reduced], env) => {
		return List.of(SpecialForms.Reduced, await evalForm(reduced, env));
	},
	[SpecialForms.Dot]: async ([object, symbol], env) => {
		object = await evalForm(object, env);
		if (typeof object !== "object" || object === null) {
			throw new TypeError(`Expected object: ${print(object)}!`);
		}
		if (typeof symbol !== "symbol") {
			throw new TypeError(`Expected symbol: ${print(symbol)}`);
		}
		let result = object[symbol.description];
		if (typeof result === "function") {
			result = result.bind(object);
		}
		return result;
	},
};
