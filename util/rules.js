import * as fs from 'node:fs/promises'
import detectIndent from 'detect-indent'
import { execa } from 'execa'
import _ from 'lodash'

export async function ruleFileMustExistAndHaveContent({ file, content: shouldContent }) {
	/** @type {string} */
	let content
	try {
		content = await fs.readFile(file, 'utf-8')
	} catch {}

	return {
		description: `File '${file}' must have content: '${shouldContent}'`,
		shouldFix() {
			return content !== shouldContent
		},
		async fix() {
			await fs.writeFile(file, shouldContent)
		},
	}
}

/**
 * @typedef ruleJsonFileMustHaveHierarchyParam
 * @property {string} file
 * @property {Record<string, unknown>} hierarchy
 */

/**
 * @param {ruleJsonFileMustHaveHierarchyParam} param0
 */
export async function ruleJsonFileMustHaveHierarchy({ file, hierarchy }) {
	return {
		id: 'must-have-hierarchy',
		async shouldFix() {
			const oldJson = JSON.parse(await fs.readFile(file, 'utf-8'))
			const newJson = _.merge(_.cloneDeep(oldJson), hierarchy)

			return !_.isEqual(oldJson, newJson)
		},
		async fix() {
			const content = await fs.readFile(file, 'utf-8')
			const newJson = _.merge(JSON.parse(content), hierarchy)

			await fs.writeFile(
				file,
				JSON.stringify(
					newJson,
					null,
					detectIndent(content).indent || '\t',
				),
			)
		}
	}
}


/**
 * @typedef ruleCheckPackageJsonDependenciesParam
 * @property {string} mainPackageName
 * @property {string[]} packages
 */

/**
 * @param {ruleCheckPackageJsonDependenciesParam} param0
 */
export async function ruleCheckPackageJsonDependencies({ mainPackageName, packages }) {
	async function packageJsonExists() {
		return await fs
			.stat('package.json')
			.then(() => true)
			.catch(() => false)
	}

	const packageJsonText = await fs.readFile('package.json', 'utf-8')
	/** @type {import('type-fest').PackageJson} */
	const packageJson = JSON.parse(packageJsonText)

	const latestVersionsObjects = await Promise.all(
		packages.map((packageName) => execa('npm', ['view', '--json', packageName])),
	)
	const latestVersions = latestVersionsObjects.map((result) => {
		if (result.exitCode !== 0) {
			console.log(result.stderr)
			throw new Error(result)
		}

		const obj = JSON.parse(result.stdout)
		return obj['dist-tags'].latest
	})

	return {
		description: `File 'package.json' is missing dependencies for package: ${mainPackageName}`,
		deps: [packageJsonExists],
		shouldFix() {
			for (const packageName of packages) {
				if (!packageJson?.devDependencies?.[packageName]) {
					return true
				}
			}

			for (let i = 0; i < packages.length; ++i) {
				const packageName = packages[i]
				// TODO: ^, etc. is not always guaranteed
				if (packageJson?.devDependencies?.[packageName].slice(1) !== latestVersions[i]) {
					return true
				}
			}
		},
		async fix() {
			const packageJsonModified = structuredClone(packageJson)
			for (let i = 0; i < packages.length; ++i) {
				const packageName = packages[i]

				// TODO: ^, etc. should not always be done
				packageJsonModified.devDependencies = {
					...packageJsonModified?.devDependencies,
					[packageName]: `^${latestVersions[i]}`,
				}
			}

			await fs.writeFile(
				'package.json',
				JSON.stringify(
					packageJsonModified,
					null,
					detectIndent(packageJsonText).indent || '\t',
				),
			)
			console.log(`Now, run: 'npm i`)
		},
	}
}
