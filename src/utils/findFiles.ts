export { findFiles }
export { findFilesParseCliArgs }
export type { GlobFilter }

import glob from 'fast-glob'
import path from 'path'
import { runCommand } from './runCommand'

type GlobFilter = {
  include: string[]
  exclude: string[]
}

const cwd = process.cwd()
let gitFiles: string[]

async function findFiles(pattern: string, globFilter: GlobFilter) {
  let files = (await glob([pattern], { ignore: ['**/node_modules/**', '**/.git/**'], cwd, dot: true }))
    .filter((filePathRelative) => applyFilter(filePathRelative, globFilter))
    .map((filePathRelative) => path.join(cwd, filePathRelative))
  files = await filterGitIgnoredFiles(files)
  return files
}

async function filterGitIgnoredFiles(files: string[]): Promise<string[]> {
  if (!gitFiles) {
    const stdout1 = await runCommand('git ls-files', { cwd })
    // Also include untracked files.
    //  - In other words, we remove git ignored files. (Staged files are tracked and listed by `$ git ls-files`.)
    //  - `git ls-files --others --exclude-standard` from https://stackoverflow.com/questions/3801321/git-list-only-untracked-files-also-custom-commands/3801554#3801554
    const stdout2 = await runCommand('git ls-files --others --exclude-standard', { cwd })
    gitFiles = [...stdout1.split('\n'), ...stdout2.split('\n')].map((filePathRelative) =>
      path.join(cwd, filePathRelative),
    )
  }
  const filesFiltered = files.filter((file) => gitFiles.includes(file))
  return filesFiltered
}

function applyFilter(filePathRelative: string, globFilter: GlobFilter) {
  if (!globFilter) {
    return true
  }
  for (const term of globFilter.include) {
    if (!filePathRelative.includes(term)) {
      return false
    }
  }
  for (const term of globFilter.exclude) {
    if (filePathRelative.includes(term)) {
      return false
    }
  }
  return true
}

function findFilesParseCliArgs(): { globFilter: GlobFilter; debug: boolean } {
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
