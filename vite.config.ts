import { defineConfig } from 'vite';
import { resolve } from 'node:path';
const pages = ['index','image/compress','image/resize','image/convert','image/metadata-cleaner','pdf/merge','pdf/extract','data/csv-viewer','developer/json-formatter'];
export default defineConfig({ base: process.env.BASE_PATH || '/', build:{ rollupOptions:{ input:Object.fromEntries(pages.map(p=>[p,resolve(__dirname,`${p}.html`)])) }}});
