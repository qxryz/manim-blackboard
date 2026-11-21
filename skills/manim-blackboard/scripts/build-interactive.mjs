/** Build an interactive SVG lesson as one offline HTML. */
import { buildHtml } from './bundle-html.mjs';

buildHtml('interactive').catch(error => {
  console.error(`Build failed: ${error.message}`);
  process.exitCode = 1;
});
