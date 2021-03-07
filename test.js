const { promises: fs } = require('fs')
const path =  require('path')
const os = require('os')

const { getPluginConfiguration } = require('@yarnpkg/cli')
const { Configuration, Project, Cache, ThrowReport } = require('@yarnpkg/core')

async function writeJSON(filename, data) {
    await fs.writeFile(filename, JSON.stringify(data), 'utf-8')
}

async function setup() {
    const workingDir = await fs.mkdtemp(path.join(os.tmpdir(), 'monorepo-'))

    // Generate root package.json
    await writeJSON(path.join(workingDir, 'package.json'), {
        name: 'monorepo',
        private: true,
        version: '1.0.0',
        workspaces: ['packages/*'],
        dependencies: { 'lodash': 'latest' },
    })

    const pkgDir = path.join(
        workingDir,
        'packages',
        'pkg-1',
    )
    await fs.mkdir(pkgDir, { recursive: true })
    await writeJSON(path.join(pkgDir, 'package.json'), {
        name: 'pkg-1',
        version: '0.0.0',
    })

    // Generate .yarnrc.yml
    const releasesDir = path.join(__dirname, '.yarn', 'releases')

    await fs.mkdir(releasesDir, { recursive: true })
    const yarnBinary = path.resolve(path.join(releasesDir, 'yarn-2.4.1.cjs'))

    if (process.env.WITH_SYMLINK === '1') {
        await fs.symlink(yarnBinary, path.join(workingDir, 'run-yarn.cjs'))
        await fs.writeFile(
            path.join(workingDir, '.yarnrc.yml'),
            `yarnPath: ./run-yarn.cjs\nenableGlobalCache: false`,
            'utf-8',
        )
    } else {
        await fs.writeFile(
            path.join(workingDir, '.yarnrc.yml'),
            `yarnPath: ${yarnBinary}\nenableGlobalCache: false`,
            'utf-8',
        )
    }

    // Initialize project
    const configuration = await Configuration.find(
        workingDir,
        getPluginConfiguration(),
    )
    const { project } = await Project.find(configuration, workingDir)
    await project.install({
        cache: await Cache.find(configuration),
        report: new ThrowReport(),
    })

    return project
}

;(async () => {
    const tempProject = await setup()
    console.log(`Temp project: ${tempProject.cwd}`)

    // this was failing in a different project.. somehow it's working now
    console.log(require.resolve('lodash', {paths:[tempProject.cwd]}))
})()
