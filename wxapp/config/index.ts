import path from 'node:path';
import fs from 'node:fs';
import { defineConfig } from '@tarojs/cli';
import { WeappTailwindcss } from 'weapp-tailwindcss/webpack';
import { NativeImageLoaderPlugin } from './native-image-loader.cjs';
import { NativeWxmlPlugin } from './native-wxml.cjs';

export default defineConfig({
  projectName: 'pokesleep-wxapp',
  date: '2026-10-06',
  designWidth: 375,
  deviceRatio: { 375: 2, 640: 1.17, 750: 1 },
  sourceRoot: 'src',
  outputRoot: 'dist',
  framework: 'vue3',
  compiler: 'webpack5',
  // Keep Chinese fallback text in UTF-8 to fit the main package budget.
  terser: {
    config: { compress: { passes: 3 }, output: { ascii_only: false } }
  },
  plugins: ['@tarojs/plugin-html'],
  alias: {
    '#platform': path.resolve(__dirname, '../src/platform'),
    'vue-router': path.resolve(__dirname, '../src/platform/router.ts'),
    vue: path.resolve(
      __dirname,
      '../node_modules/vue/dist/vue.runtime.esm-bundler.js'
    ),
    pinia: path.resolve(__dirname, '../node_modules/pinia/dist/pinia.js')
  },
  defineConstants: {
    __APP_VERSION__: JSON.stringify(
      JSON.parse(
        fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')
      ).version
    )
  },
  copy: {
    patterns: [
      { from: 'src/assets/tabbar', to: 'dist/assets/tabbar' },
      { from: 'src/workers', to: 'dist/workers' },
      { from: 'src/native/image-loader.js', to: 'dist/image-loader.js' },
      { from: 'src/native/i18n-loader.js', to: 'dist/i18n-loader.js' },
      { from: 'src/i18n-pack/i18n.js', to: 'dist/i18n-pack/i18n.js' },
      ...fs
        .readdirSync(path.resolve(__dirname, '../src'))
        .filter(name => /^(asset|ocr)-pack\d+$/.test(name))
        .map(name => ({
          from: `src/${name}`,
          to: `dist/${name}`,
          ignore: ['**/*.vue', '**/*.ts']
        }))
    ]
  },
  mini: {
    compile: { include: [path.resolve(__dirname, '../../core')] },
    postcss: {
      pxtransform: { enable: true },
      cssModules: { enable: false },
      htmltransform: { enable: true, config: { removeCursorStyle: false } }
    },
    webpackChain(chain) {
      chain.resolve.modules.add(path.resolve(__dirname, '../node_modules'));
      chain.module
        .rule('compressed-core-data')
        .test(/\.json$/)
        .include.add(path.resolve(__dirname, '../../core/src/data'))
        .end()
        .type('javascript/auto')
        .use('compressed-json')
        .loader(path.resolve(__dirname, 'compressed-json.cjs'));
      // Image indexes are large plain JSON too. Preserve their values while
      // keeping the resource update feature within the existing main-pack limit.
      chain.module
        .rule('compressed-core-data')
        .include.add(path.resolve(__dirname, '../src/platform/image-map.json'))
        .add(path.resolve(__dirname, '../src/platform/image-manifest.json'));
      chain.externals({
        '#image-loader': 'commonjs ./image-loader.js',
        '#i18n-loader': 'commonjs ./i18n-loader.js'
      });
      chain.plugin('i18n-subpackage').use(
        class I18nSubpackagePlugin {
          apply(compiler: {
            hooks: {
              normalModuleFactory: {
                tap: (
                  name: string,
                  fn: (factory: {
                    hooks: {
                      afterResolve: {
                        tap: (
                          name: string,
                          fn: (result: {
                            context?: string;
                            createData?: {
                              resource?: string;
                              context?: string;
                            };
                          }) => void
                        ) => void;
                      };
                    };
                  }) => void
                ) => void;
              };
            };
          }) {
            const facade = path.resolve(__dirname, '../src/platform');
            const moves = new Map([
              ['/core/src/ui/i18n.ts', path.join(facade, 'i18nFacade.ts')],
              [
                '/core/src/ui/gameLabels.ts',
                path.join(facade, 'gameLabelFacade.ts')
              ]
            ]);
            compiler.hooks.normalModuleFactory.tap(
              'I18nSubpackagePlugin',
              factory => {
                factory.hooks.afterResolve.tap(
                  'I18nSubpackagePlugin',
                  result => {
                    const resource = result.createData?.resource;
                    if (!resource) return;
                    const normalized = resource.replaceAll('\\', '/');
                    for (const [suffix, target] of moves) {
                      if (!normalized.endsWith(suffix)) continue;
                      const context = path.dirname(target);
                      result.context = context;
                      result.createData!.resource = target;
                      result.createData!.context = context;
                    }
                  }
                );
              }
            );
          }
        }
      );
      chain.plugin('native-image-loader-paths').use(NativeImageLoaderPlugin);
      chain.plugin('native-wxml').use(NativeWxmlPlugin);
      chain.plugin('weapp-tailwindcss').use(WeappTailwindcss, [
        {
          tailwindcssBasedir: path.resolve(__dirname, '..'),
          cssEntries: [path.resolve(__dirname, '../src/tailwind.css')],
          cssOptions: {
            rem2rpx: true,
            injectAdditionalCssVarScope: true,
            cssPreflight: false,
            cssSelectorReplacement: { root: 'page' }
          }
        }
      ]);
    }
  }
});
