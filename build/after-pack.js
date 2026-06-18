// after-pack.js — runs after electron-builder packages each .app.
// We disable electron-builder's own signing (mac.identity: null) and do a
// proper deep ad-hoc sign here. Without --deep the resulting bundle lacks a
// CodeResources manifest and Gatekeeper rejects it with the misleading
// "is damaged and can't be opened" error.

const { execFileSync } = require('child_process');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;
  console.log(`Ad-hoc signing ${appPath}`);
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' });
  console.log('Ad-hoc signature applied and verified');
};
