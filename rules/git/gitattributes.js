import * as fs from 'node:fs/promises'
import path from 'node:path'

import { fileExists, pkgRoot } from '../../util/util.js'

/** @type {import('../../index.js').CreateRules} */
export async function createRules({ project }) {
	const configFile = '.gitattributes'

	return [
		{
			id: 'gitattributes-exists',
			async shouldFix() {
				return !(await fileExists(configFile))
			},
			async fix() {
				await fs.writeFile(
					configFile,
					`# foxxo start
* text=auto eol=lf
bake linguist-generated
# foxxo end
`,
				)
			},
		},
		{
			id: 'gitattributes-has-text-auto',
			async shouldFix() {
				return !(await fs.readFile('.gitattributes', 'utf-8')).includes(
					'* text=auto eol=lf\n',
				)
			},
		},
		{
			id: 'gitattributes-has-bake-linguist-generated',
			async shouldFix() {
				return !(await fs.readFile('.gitattributes', 'utf-8')).includes(
					'bake linguist-generated\n',
				)
			},
		},
	]
}
