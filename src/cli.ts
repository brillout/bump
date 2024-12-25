// @ts-ignore
import 'source-map-support/register.js'
import { bumpDependencies, type PackageToBump } from './bumpDependencies.js'
import type { GlobFilter } from './utils/index.js'

initPromiseRejectionHandler()
cli()

function cli() {
  const { globFilter, packagesToBump } = parseCliArgs()
  bumpDependencies(packagesToBump, globFilter)
}

function parseCliArgs() {
  const globFilter: GlobFilter = {
    include: [],
    exclude: [],
  }
  const packagesToBump: PackageToBump[] = []

  let isGlobFilter: undefined | '--include' | '--exclude'
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      if (arg === '--include') {
        isGlobFilter = '--include'
      } else if (arg === '--exclude') {
        isGlobFilter = '--exclude'
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
        packagesToBump.push(parsePackageToBump(arg))
      }
    }
  }

  return {
    globFilter,
    packagesToBump,
  }
}

function parsePackageToBump(packageArg: string): PackageToBump {
  const [packageName, packageVersion] = packageArg.split('@')
  if (!packageVersion) {
    console.error(`Specify version for ${packageName} to bump to`)
    showHelp()
    process.exit(1)
  }
  return { packageName, packageVersion }
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
      '  $ bump                      # Bump all dependencies of all the package.json files in the entire monorepo',
      "  $ bump --include examples   # Only touch package.json files that contain 'examples' in their path",
      "  $ bump --exclude examples   # Only touch package.json files that don't contain 'examples' in their path",
      '  $ bump vite@^6.0.5          # Bump all dependency to the `vite` package to `^6.0.5`',
    ].join('\n'),
  )
}
