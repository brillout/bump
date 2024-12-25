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
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--')) {
      if (arg === '--include') {
        isGlobFilter = '--include'
      } else if (arg === '--exclude') {
        isGlobFilter = '--exclude'
      } else {
        throw new Error('Unknown option ' + arg)
      }
    } else {
      if (isGlobFilter) {
        const bucket = isGlobFilter === '--include' ? 'include' : 'exclude'
        globFilter[bucket].push(arg)
      } else {
        packagesToBump.push(parsePackageToBump(arg))
      }
    }
  })

  return {
    globFilter,
    packagesToBump,
  }
}

function parsePackageToBump(packageArg: string): PackageToBump {
  const [packageName, packageVersion] = packageArg.split('@')
  if (!packageVersion) throw new Error(`Specify version for ${packageName} to bump to`)
  return { packageName, packageVersion }
}

function initPromiseRejectionHandler() {
  process.on('unhandledRejection', function (err) {
    console.error(err)
    process.exit(1)
  })
}
