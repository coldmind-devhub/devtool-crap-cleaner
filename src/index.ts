#!/usr/bin/env node

import { Command } from 'commander';
import { readdir, stat, writeFile, readFile, rmdir } from 'fs/promises';
import { join } from 'path';

const program = new Command();

// Helper function to get the directory size
async function getDirectorySize(directory: string): Promise<number> {
	const files = await readdir(directory);
	let size = 0;

	for (const file of files) {
		const filePath = join(directory, file);
		const fileStat = await stat(filePath);

		if (fileStat.isDirectory()) {
			size += await getDirectorySize(filePath);
		} else {
			size += fileStat.size;
		}
	}

	return size;
}

// Main function to recursively search directories
async function searchDirectories(directory: string, threshold: number, saveToFile: boolean): Promise<any[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const foundDirectories = [];

	for (const entry of entries) {
		const entryPath = join(directory, entry.name);
		if (entry.isDirectory()) {
			const size = await getDirectorySize(entryPath);
			const sizeInMB = size / (1024 * 1024);

			process.stdout.write(`\rScanning: ${entryPath}`); // Overwrite the current line with the updated directory

			if (sizeInMB > threshold) {
				console.log(`\nMatch found: ${entryPath} | Size: ${sizeInMB.toFixed(2)} MB`);
				foundDirectories.push({ path: entryPath, size: sizeInMB });
			}
			foundDirectories.push(...(await searchDirectories(entryPath, threshold, saveToFile)));
		}
	}

	if (saveToFile) {
		await writeFile('foundDirectories.json', JSON.stringify(foundDirectories, null, 2));
	}

	return foundDirectories;
}

// Function to remove directories listed in the JSON file
async function removeDirectories(): Promise<void> {
	try {
		const data = await readFile('foundDirectories.json', 'utf-8');
		const directories = JSON.parse(data);

		for (const dir of directories) {
			await rmdir(dir.path, { recursive: true });
			console.log(`Removed directory: ${dir.path}`);
		}

	} catch (error) {
		console.error('Error:', (error as Error).message);
	}
}

// Set up command-line interface using Commander
program
	.version('1.0.0')
	.description('DevCrapCommander: Find directories with total size greater than a given threshold in MB');

program
	.command('search <directory> <threshold>')
	.option('-s, --save', 'Save the found directories to a JSON file')
	.action(async (directory: string, threshold: string, options: { save: boolean }) => {
		try {
			let sizeThreshold = parseFloat(threshold)
			await searchDirectories(directory, sizeThreshold, options.save);
		} catch (error) {
			console.error('Error:', (error as Error).message);
		}
	});

program
	.command('remove')
	.description('Remove directories listed in the foundDirectories.json file')
	.action(removeDirectories);

program.parse(process.argv);

