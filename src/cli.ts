// @ts-ignore
import 'source-map-support/register'
import { bumpDependencies } from './bumpDependencies'
import type { GlobFilter } from './utils'

initPromiseRejectionHandler()
cli()

function cli() {
  const { globFilter } = parseCliArgs()
  bumpDependencies(globFilter)
}

function parseCliArgs() {
  const globFilter: GlobFilter = {
    include: [],
    exclude: [],
  }

  let debug = false
  let isGlobFilter: undefined | '--include' | '--exclude'
  process.argv.slice(2).forEach((arg) => {
    if (arg === '--debug') {
      debug = true
    } else if (arg === '--include') {
      isGlobFilter = '--include'
    } else if (arg === '--exclude') {
      isGlobFilter = '--exclude'
    } else {
      if (isGlobFilter) {
        const bucket = isGlobFilter === '--include' ? 'include' : 'exclude'
        globFilter[bucket].push(arg)
      }
    }
  })

  return {
    globFilter,
    debug,
  }
}

function initPromiseRejectionHandler() {
  process.on('unhandledRejection', function (err) {
    console.error(err)
    process.exit(1)
  })
}
