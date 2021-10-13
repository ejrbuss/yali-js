// This is a barebones test framework to keep this project dependency free
import assert from "assert";
import { AnsiCodes, applyCode } from "../src/AnsiCodes.js";
import { exec } from "../src/Builtins.js";

let passes = 0;
let fails = 0;
let errors = 0;

export async function test(name, testFunction) {
	try {
		await testFunction();
		passes += 1;
		console.log(applyCode(AnsiCodes.FgGreen, ` ✔ ${name}`));
	} catch (error) {
		if (error instanceof assert.AssertionError) {
			fails += 1;
		} else {
			errors += 1;
			console.log();
			console.log(applyCode(AnsiCodes.FgRed, ` ✘ ${name}`));
			console.error(error);
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
	let passesText = applyCode(AnsiCodes.FgGreen, passes);
	let failsText = applyCode(AnsiCodes.FgRed, fails);
	let errorsText = applyCode(AnsiCodes.FgYellow, errors);
	console.log(
		`\n${header} Passes: ${passesText} Fails: ${failsText} Errors: ${errorsText}\n`
	);
}

main();
