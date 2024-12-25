export { bumpDependencies }
export { PackageToBump }

import { execa } from 'execa'
import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { findFiles, GlobFilter, logProgress, runCommand } from './utils/index.js'
import pc from 'picocolors'
const __filename = new URL('', import.meta.url).pathname
const __dirname = path.dirname(__filename)
const npmCheckUpdates = path.join(__dirname, '../node_modules/.bin/npm-check-updates')

const iconWarning = '⚠️'

/*
const FREEZE_VUE = true
/*/
const FREEZE_VUE = false
//*/

const SKIP_LIST = [
  'node-fetch',
  '@types/node-fetch',
  'p-limit',
  'vite-plugin-md',
  'graphql',
  '@apollo/client',
  'webpack', // Telefunc
]

if (FREEZE_VUE) {
  SKIP_LIST.push(...['vue', '@vue/server-renderer', '@vue/compiler-sfc', '@vitejs/plugin-vue', 'vite-plugin-md'])
}

type PackageToBump = {
  packageName: string
  packageVersion: string
}

async function bumpDependencies(packagesToBump: PackageToBump[], globFilter: GlobFilter) {
  const skipped: string[] = []
  for (const packageJsonFile of await getAllPackageJsonFiles(globFilter)) {
    if (!include(packageJsonFile)) {
      skipped.push(packageJsonFile)
      continue
    }
    const cwd = path.dirname(packageJsonFile)
    const reject = SKIP_LIST.length === 0 ? '' : `--reject ${SKIP_LIST.join(',')}`
    console.log('\n')
    console.log(pc.green(pc.bold(`[UPGRADE] ${cwd}`)))

    if (packagesToBump.length === 0) {
      const cmd = `${npmCheckUpdates} -u --dep dev,prod ${reject}`
      await run__follow(cmd, { cwd })
      if (!FREEZE_VUE) {
        await run__follow(`${npmCheckUpdates} -u --dep dev,prod vue --target greatest`, { cwd })
      }
    } else {
      const packageJson = readPackageJson(packageJsonFile)
      packagesToBump.forEach(({ packageName, packageVersion }) => {
        const depLists: (undefined | Record<string, string>)[] = [packageJson.dependencies, packageJson.devDependencies]
        depLists.forEach((depList) => {
          if (depList?.[packageName]) {
            depList[packageName] = packageVersion
          }
        })
      })
      fs.writeFileSync(packageJsonFile, JSON.stringify(packageJson, null, 2))
    }
  }
  console.log('\n')
  console.log(pc.green(pc.bold('DONE.')))
  console.log(iconWarning + ' [SKIPPED] Deps:\n' + JSON.stringify(SKIP_LIST, null, 2))
  console.log(iconWarning + ' [SKIPPED] package.json:\n' + JSON.stringify(skipped, null, 2))
  const done = logProgress('Update `pnpm-lock.yaml`')
  await updatePnpmLockFile()
  done()
  await commit()
}

async function updatePnpmLockFile() {
  const cwd = process.cwd()
  await run__return('pnpm install', { cwd })
}

async function commit() {
  await runCommand("git commit -am 'chore: update dependencies'", { swallowError: true })
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

function readPackageJson(packageJsonFile: string) {
  const packageJson: {
    name?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  } = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'))
  return packageJson
}

function dirHasTest(dir: string) {
  const files = fs.readdirSync(dir)
  return files.some((file) => file.includes('.test.'))
}
