import { defineConfig, } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from "vite-plugin-svgr";
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import inject from '@rollup/plugin-inject';

let base = process.env.PUBLIC_URL ?? '/';
if(!base.endsWith("/")) base += '/';

console.log(`Building for base = ${base}`);

// https://vitejs.dev/config/
export default ({ mode }) => {
  return defineConfig({
    base,
    plugins: [ svgr(), react(), nodePolyfills({
      globals: {
        Buffer: false,
      },
      exclude: ['buffer'],
    }), ],
    build: {
      commonjsOptions: { transformMixedEsModules: true },
      rollupOptions: {
        plugins: [inject({ Buffer: ['buffer', 'Buffer'] })],
      },
    }
  })  
}
