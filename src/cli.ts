// @ts-ignore
import 'source-map-support/register'
import { bumpDependencies } from './bumpDependencies'
import { findFilesParseCliArgs } from './utils'

initPromiseRejectionHandler()
cli()

function cli() {
  const { globFilter } = findFilesParseCliArgs()
  bumpDependencies(globFilter)
}

function initPromiseRejectionHandler() {
  process.on('unhandledRejection', function (err) {
    console.error(err)
    process.exit(1)
  })
}
