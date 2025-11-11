export { bumpDependencies }
export { PackageToBump }

import { execa } from 'execa'
import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { findFiles, GlobFilter, logProgress, readPackageJson, runCommand } from './utils/index.js'
import pc from 'picocolors'
import type { Args } from './cli.js'
const __filename = new URL('', import.meta.url).pathname
const __dirname = path.dirname(__filename)
const npmCheckUpdates = path.join(__dirname, '../node_modules/.bin/npm-check-updates')

/*
const FREEZE_VUE = true
/*/
const FREEZE_VUE = false
//*/

// TODO/eventually: don't update pinned dependencies instead of `SKIP_LIST`
//  - Does https://www.npmjs.com/package/npm-check-updates have an option to skip pinned dependencies? If it doesn't then let's simply read the package.json before running npm-check-updates while setting --reject accordingly.
const FREEZE_LIST = [
  'node-fetch',
  '@types/node-fetch',
  'p-limit',
  'vite-plugin-md',
  'graphql',
  '@apollo/client',
  'webpack', // Telefunc
]
if (FREEZE_VUE) {
  FREEZE_LIST.push(...['vue', '@vue/server-renderer', '@vue/compiler-sfc', '@vitejs/plugin-vue', 'vite-plugin-md'])
}

type PackageToBump = {
  packageName: string
  packageSemver: string
  packageWasFound?: true
}

async function bumpDependencies(args: Args) {
  const { packagesToBump } = args
  const updateDepsDev = !args.onlyProd || args.onlyDev
  const updateDepsProd = !args.onlyDev || args.onlyProd
  const updateDepsPnpmOverrides = !args.onlyDev && !args.onlyProd

  let noChange = true
  for (const packageJsonFile of await getAllPackageJsonFiles(args.globFilter)) {
    /* Re-implement this logic?
    if (!include(packageJsonFile)) {
      skipped.push(packageJsonFile)
      continue
    }
    */
    if (packagesToBump.length === 0) {
      const packageJsonDir = path.dirname(packageJsonFile)
      const reject = FREEZE_LIST.length === 0 ? '' : `--reject ${FREEZE_LIST.join(',')}`
      console.log('\n')
      console.log(pc.green(pc.bold(`[UPGRADE] ${packageJsonDir}`)))
      const cmd = `${npmCheckUpdates} -u --dep dev,prod ${reject}`
      await run__follow(cmd, { cwd: packageJsonDir })
      if (!FREEZE_VUE) {
        await run__follow(`${npmCheckUpdates} -u --dep dev,prod vue --target greatest`, { cwd: packageJsonDir })
      }
      noChange = false
    } else {
      const packageJson = readPackageJson(packageJsonFile)
      let noChangeLocal = true
      packagesToBump.forEach((pkg) => {
        const { packageName, packageSemver } = pkg
        const depLists: (undefined | Record<string, string>)[] = [
          updateDepsProd && packageJson.dependencies,
          updateDepsDev && packageJson.devDependencies,
          updateDepsPnpmOverrides && packageJson.pnpm?.overrides,
        ].filter((v) => v !== false)
        depLists.forEach((depList) => {
          const packageSemverCurrent = depList?.[packageName]
          if (!packageSemverCurrent) return
          pkg.packageWasFound = true
          if (/^[0-9]/.test(packageSemverCurrent) && !args.forceBump) {
            console.log(
              `${pc.yellow('SKIPPED')} ${pc.cyan(packageName)} because it's pinned to ${pc.bold(packageSemverCurrent)} at ${packageJsonFile}`,
            )
            return
          }
          if (packageSemverCurrent === packageSemver) return
          depList[packageName] = packageSemver
          noChangeLocal = false
        })
      })
      if (!noChangeLocal) {
        fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2) + '\n')
        noChange = false
      }
    }
  }

  packagesToBump.forEach(({ packageName, packageWasFound }) => {
    if (!packageWasFound) {
      console.error(pc.red(`Package ${pc.bold(packageName)} not found in any ${pc.bold('package.json')} file.`))
      process.exit(1)
    }
  })

  if (noChange) {
    console.log(pc.blue(pc.bold('No operation: everything is up-to-date.')))
    return
  }
  console.log(pc.green(pc.bold('Done.')))

  const done = logProgress('Update `pnpm-lock.yaml`')
  await updatePnpmLockFile()
  done()

  const commitMessage =
    packagesToBump.length === 0
      ? 'chore: bump all dependencies'
      : `chore: ${packagesToBump.map((p) => `${p.packageName}@${p.packageSemver}`).join(' ')}`
  await commit(commitMessage)
}

async function updatePnpmLockFile() {
  const cwd = process.cwd()
  await run__return('pnpm install', { cwd })
}

async function commit(commitMessage: string) {
  await runCommand(`git commit -am '${commitMessage}'`, { swallowError: true })
}

async function getAllPackageJsonFiles(globFilter: GlobFilter) {
  const packageJsonFiles = await findFiles('**/package.json', globFilter)
  return packageJsonFiles
}

async function run__follow(cmd: string, { cwd }: { cwd: string }): Promise<void> {
  const [command, ...args] = cmd.split(' ')
  await execa(command, args, { cwd, stdio: 'inherit' })
}
async function run__return(cmd: string, { cwd }: { cwd: string }): Promise<string> {
  const [command, ...args] = cmd.split(' ')
  const { stdout } = await execa(command, args, { cwd })
  return stdout
}

function include(packageJsonFile: string): boolean {
  const dir = path.dirname(packageJsonFile)
  assert(path.isAbsolute(dir))
  const packageJson: { name?: string } = readPackageJson(packageJsonFile)
  if (packageJson.name && !packageJson.name.startsWith('create-')) {
    return true
  }
  if (path.resolve(dir) === path.resolve(process.cwd())) {
    return true
  }
  if (dirHasTest(dir)) {
    return true
  }
  return false
}

function dirHasTest(dir: string) {
  const files = fs.readdirSync(dir)
  return files.some((file) => file.includes('.test.'))
}
