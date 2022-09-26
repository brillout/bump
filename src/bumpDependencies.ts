export { bumpDependencies }

import execa from 'execa'
import fs from 'fs'
import path from 'path'
import assert from 'assert'
import { findFiles, FindFilter, logProgress, runCommand } from './utils'
import { green, bold } from 'picocolors'
const npmCheckUpdates = require.resolve(`${process.cwd()}/node_modules/.bin/npm-check-updates`)

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

async function bumpDependencies(filter: null | FindFilter) {
  const skipped: string[] = []
  for (const packageJsonFile of await getAllPackageJsonFiles(filter)) {
    if (!include(packageJsonFile)) {
      skipped.push(packageJsonFile)
      continue
    }
    const cwd = path.dirname(packageJsonFile)
    const reject = SKIP_LIST.length === 0 ? '' : `--reject ${SKIP_LIST.join(',')}`
    console.log('\n')
    console.log(green(bold(`[UPGRADE] ${cwd}`)))
    const cmd = `${npmCheckUpdates} -u --dep dev,prod ${reject}`
    await run__follow(cmd, { cwd })
    if (!FREEZE_VUE) {
      await run__follow(`${npmCheckUpdates} -u --dep dev,prod vue --target greatest`, { cwd })
    }
  }
  console.log('\n')
  console.log(green(bold('DONE.')))
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

async function getAllPackageJsonFiles(filter: null | FindFilter) {
  const packageJsonFiles = await findFiles('**/package.json', filter)
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
  const packageJson: { name?: string } = require(packageJsonFile)
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
