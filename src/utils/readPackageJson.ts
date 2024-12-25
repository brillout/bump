export { readPackageJson }

import fs from 'fs'

function readPackageJson(packageJsonFile: string) {
  const packageJson: {
    name?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  } = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'))
  return packageJson
}
