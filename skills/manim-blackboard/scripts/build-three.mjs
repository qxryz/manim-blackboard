/** Build a Three.js lesson as one offline HTML. */
import { buildHtml } from './bundle-html.mjs';

buildHtml('three').catch(error => {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
});
