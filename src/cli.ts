import 'source-map-support/register.js'
import { bumpDependencies, type PackageToBump } from './bumpDependencies.js'
import { readPackageJson, runCommand, type GlobFilter } from './utils/index.js'
import path from 'path'
const __filename = new URL('', import.meta.url).pathname
const __dirname = path.dirname(__filename)

initPromiseRejectionHandler()
cli()

async function cli() {
  const { globFilter, packagesToBump, forceBump } = await parseCliArgs()
  bumpDependencies(packagesToBump, globFilter, forceBump)
}

async function parseCliArgs() {
  const globFilter: GlobFilter = {
    include: [],
    exclude: [],
  }
  const packagesToBump: PackageToBump[] = []

  let forceBump = false
  let isGlobFilter: undefined | '--include' | '--exclude'
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('-')) {
      if (arg === '--include') {
        isGlobFilter = '--include'
      } else if (arg === '--exclude') {
        isGlobFilter = '--exclude'
      } else if (arg === '--force') {
        forceBump = true
      } else if (arg === '--version' || arg === '-v') {
        const root = path.join(__dirname, '..')
        const { version } = readPackageJson(path.join(root, './package.json'))
        console.log(version!)
        console.log(root)
        process.exit(1)
      } else if (arg === '--help' || arg === '-h') {
        showHelp()
        process.exit(1)
      } else {
        console.error('Unknown option ' + arg)
        showHelp()
        process.exit(1)
      }
    } else {
      if (isGlobFilter) {
        const bucket = isGlobFilter === '--include' ? 'include' : 'exclude'
        globFilter[bucket].push(arg)
      } else {
        const packageName = arg
        const packageVersionLatest = await getPackageVersionLatest(packageName)
        const packageSemver = '^' + packageVersionLatest
        packagesToBump.push({ packageName, packageSemver })
      }
    }
  }

  return {
    globFilter,
    packagesToBump,
    forceBump,
  }
}

async function getPackageVersionLatest(packageName: string) {
  const stdout = await runCommand(`npm show ${packageName} version`, { timeout: 20 * 1000 })
  return stdout.trim()
}

function initPromiseRejectionHandler() {
  process.on('unhandledRejection', function (err) {
    console.error(err)
    process.exit(1)
  })
}

function showHelp() {
  console.log(
    [
      'Usage:',
      '  $ bump                         # Bump all dependencies of all the package.json files in the entire monorepo',
      '  $ bump some-package            # Bump some-package to its latest version',
      "  $ bump some-package --force    # Bump some-package even if it's pinned",
      "  $ bump --include examples      # Only touch package.json files that contain 'examples' in their path",
      "  $ bump --exclude examples      # Only touch package.json files that don't contain 'examples' in their path",
    ].join('\n'),
  )
}
