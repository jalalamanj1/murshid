/**
 * Trial build configuration: separate name/appId/output, 7-day trial.
 * Build with:
 *   $env:VITE_TRIAL='1'; npm run build
 *   npx electron-builder --win --config electron-builder.trial.cjs
 * and keep electron/trial.flag present while packaging.
 */
const pkg = require('./package.json');

module.exports = {
  ...pkg.build,
  appId: 'com.pandaratech.murshid.trial',
  productName: 'مرشد تجريبي',
  directories: {
    ...pkg.build.directories,
    output: 'release-trial',
  },
  publish: null,
  win: {
    ...pkg.build.win,
    artifactName: 'murshid-trial-${version}-win-${arch}.exe',
  },
};
