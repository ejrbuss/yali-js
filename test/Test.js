// This is a barebones test framework to keep this project dependency free
import assert from "assert";
import { AnsiCodes, applyCode } from "../src/AnsiCodes.js";
import { exec } from "../src/Builtins.js";

let passes = 0;

const Fails = [];
const Errors = [];

function printSuccess(name) {
	console.log(applyCode(AnsiCodes.FgGreen, ` ✔ ${name}`));
}

function printFail(name, error) {
	console.log(applyCode(AnsiCodes.FgRed, ` ✘ ${name}\n`));
	console.error(error);
	console.log();
}

function printError(name, error) {
	console.log(applyCode(AnsiCodes.FgYellow, ` ✘ ${name}\n`));
	console.error(error);
	console.log();
}

export async function test(name, testFunction) {
	try {
		await testFunction();
		passes += 1;
		console.log(applyCode(AnsiCodes.FgGreen, ` ✔ ${name}`));
	} catch (error) {
		delete error.env; // decrease noise
		if (error instanceof assert.AssertionError) {
			Fails.push([name, error]);
			printFail(name, error);
		} else {
			Errors.push([name, error]);
			printError(name, error);
		}
	}
}

export async function main() {
	let header = applyCode(
		AnsiCodes.FgBlack + AnsiCodes.Bright + AnsiCodes.BgGreen,
		" TEST "
	);
	let testFiles = (await exec(`find ./test/**.js`)).trim().split("\n");
	for (const testFile of testFiles) {
		try {
			const basename = testFile.replace(/^\.\/test\//, "");
			if (basename === "Test.js") {
				continue;
			}
			console.log(`\n${header} Running tests in ${basename} ...\n`);
			await import(`./${basename}`);
		} catch (error) {
			console.log();
			console.error(error);
			process.exit(1);
		}
	}

	if (Fails.length > 0) {
		console.log(`\n${header} Test failures\n`);
		for (const [name, error] of Fails) {
			printFail(name, error);
		}
	}

	if (Errors.length > 0) {
		console.log(`\n${header} Test errors\n`);
		for (const [name, error] of Errors) {
			printError(name, error);
		}
	}

	let passesText = applyCode(AnsiCodes.FgGreen, passes);
	let failsText = applyCode(AnsiCodes.FgRed, Fails.length);
	let errorsText = applyCode(AnsiCodes.FgYellow, Errors.length);
	console.log(
		`\n${header} Passes: ${passesText} Fails: ${failsText} Errors: ${errorsText}\n`
	);
}

main();
