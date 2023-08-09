#!/usr/bin/env node

const process = require('process')

const { Octokit: RawOctokit } = require('@octokit/core')
const { program } = require('commander')

const { paginateRest } = require('@octokit/plugin-paginate-rest')
const { restEndpointMethods } = require('@octokit/plugin-rest-endpoint-methods')
const Octokit = RawOctokit.plugin(restEndpointMethods, paginateRest)

const croak = () => {
  console.error(...arguments)
  process.exit(-1)
}

const get_opts = () => {
  program
    .option('--org <organization>', 'The GitHub organization to scan.')
    .option(
      '--token <token>',
      'The GitHub token to use for authentication. By default, $GITHUB_TOKEN is used.',
      // Not actually putting the default here since the value would be printed in
      // a --help message.
    )
    .option(
      '-d, --dependency <dependency-name-here>',
      'The name of the dependency to look for.',
    )
    .option(
      '-s, --semver <semver>',
      'The NPM-compatible semantic version to look for.',
    )
    .parse()

  const opts = program.opts()
  console.debug({ opts })

  // A little validation
  if (
    !opts.dependency.match(
      /^[a-zA-Z0-9_.@-]+$/ ||
        encodeURIComponent(opts.dependency) !== opts.dependency,
    )
  ) {
    croak(`Dependency name ${opts.dependency} is not a valid NPM package name.`)
  }

  // We do need a token
  opts.token ||= process.env['GITHUB_TOKEN']
  if (!opts.token) {
    croak('No GitHub token provided.')
  }

  return opts
}

const init = () => {
  const opts = get_opts()
  const gh = new Octokit({ auth: opts.token })

  return Promise.resolve({ opts, gh })
}

const get_repository_leads = async ({ opts, gh }) => {
  const org_name = opts.org
  const dep_name = opts.dependency

  // Call the GitHub code search API to find all repositories that import the lodash package and are not archived.

  const terms = encodeURI(`org:${org_name}+${dep_name}+-is:archived+-is:fork+language:json`)
  console.log({ terms })

  return gh.paginate(
    gh.rest.search.code,
    {
      q: terms,
    },
    // (resp) => resp.data,
  )
}

const find_affected_dependents = async ({ gh, opts }, paginator) => {
  // console.log(JSON.stringify({ paginator }, undefined, 2))

  // First, let's filter out anything that's not a package.json or package-lock.json file.
  const filtered_and_mapped = paginator.filter(
    (item) =>
      !!item?.repository?.full_name && item.name.match(/package(-lock)?\.json$/i)
  ).map(
    (item) => ({ repo_name: item?.repository?.full_name, file_name: item.name })
  )

  for (const item of filtered_and_mapped) {
    console.log("!!ITEM!!", item)
  }

  return Promise.resolve()
}

const main = async () => {
  const ctx = await init()
  const paginator = await get_repository_leads(ctx)
  const hits = await find_affected_dependents(ctx, paginator)

  console.log('Main exiting.')
}

main().then(() => console.log('All done.'))
// .finally(() => process.exit(0))
