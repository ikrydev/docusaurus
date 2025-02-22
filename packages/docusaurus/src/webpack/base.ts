/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import fs from 'fs-extra';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import OptimizeCSSAssetsPlugin from 'optimize-css-assets-webpack-plugin';
import path from 'path';
import TerserPlugin from 'terser-webpack-plugin';
import {Configuration, Loader} from 'webpack';

import {Props} from '@docusaurus/types';
import {getBabelLoader, getCacheLoader, getStyleLoaders} from './utils';

const CSS_REGEX = /\.css$/;
const CSS_MODULE_REGEX = /\.module\.css$/;

export function createBaseConfig(
  props: Props,
  isServer: boolean,
): Configuration {
  const {outDir, siteDir, baseUrl, generatedFilesDir, routesPaths} = props;

  const clientDir = path.join(__dirname, '..', 'client');
  const totalPages = routesPaths.length;
  const isProd = process.env.NODE_ENV === 'production';
  return {
    mode: isProd ? 'production' : 'development',
    output: {
      pathinfo: false,
      path: outDir,
      filename: isProd ? '[name].[contenthash:8].js' : '[name].js',
      chunkFilename: isProd ? '[name].[contenthash:8].js' : '[name].js',
      publicPath: baseUrl,
    },
    // Don't throw warning when asset created is over 250kb
    performance: {
      hints: false,
    },
    devtool: isProd ? false : 'cheap-module-eval-source-map',
    resolve: {
      symlinks: true,
      alias: {
        // https://stackoverflow.com/a/55433680/6072730
        ejs: 'ejs/ejs.min.js',
        '@site': siteDir,
        '@generated': generatedFilesDir,
        '@docusaurus': path.resolve(__dirname, '../client/exports'),
      },
      modules: [
        'node_modules',
        path.resolve(fs.realpathSync(process.cwd()), 'node_modules'),
      ],
    },
    optimization: {
      removeAvailableModules: false,
      // Only minimize client bundle in production because server bundle is only used for static site generation
      minimize: isProd && !isServer,
      minimizer: isProd
        ? [
            new TerserPlugin({
              cache: true,
              parallel: true,
              sourceMap: false,
              terserOptions: {
                parse: {
                  // we want uglify-js to parse ecma 8 code. However, we don't want it
                  // to apply any minfication steps that turns valid ecma 5 code
                  // into invalid ecma 5 code. This is why the 'compress' and 'output'
                  // sections only apply transformations that are ecma 5 safe
                  // https://github.com/facebook/create-react-app/pull/4234
                  ecma: 8,
                },
                compress: {
                  ecma: 5,
                  warnings: false,
                },
                mangle: {
                  safari10: true,
                },
                output: {
                  ecma: 5,
                  comments: false,
                  // Turned on because emoji and regex is not minified properly using default
                  // https://github.com/facebook/create-react-app/issues/2488
                  ascii_only: true,
                },
              },
            }),
            new OptimizeCSSAssetsPlugin({
              cssProcessorPluginOptions: {
                preset: 'default',
              },
            }),
          ]
        : undefined,
      splitChunks: {
        // Since the chunk name includes all origin chunk names it’s recommended for production builds with long term caching to NOT include [name] in the filenames
        name: false,
        cacheGroups: {
          // disable the built-in cacheGroups
          default: false,
          common: {
            name: 'common',
            minChunks: totalPages > 2 ? totalPages * 0.5 : 2,
            priority: 40,
          },
        },
      },
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: modulePath => {
            // always transpile client dir
            if (modulePath.startsWith(clientDir)) {
              return false;
            }
            // Don't transpile node_modules except any docusaurus npm package
            return (
              /node_modules/.test(modulePath) &&
              !/(docusaurus)((?!node_modules).)*\.jsx?$/.test(modulePath)
            );
          },
          use: [getCacheLoader(isServer), getBabelLoader(isServer)].filter(
            Boolean,
          ) as Loader[],
        },
        {
          test: CSS_REGEX,
          exclude: CSS_MODULE_REGEX,
          use: getStyleLoaders(isServer, {
            importLoaders: 1,
            sourceMap: !isProd,
          }),
        },
        // Adds support for CSS Modules (https://github.com/css-modules/css-modules)
        // using the extension .module.css
        {
          test: CSS_MODULE_REGEX,
          use: getStyleLoaders(isServer, {
            modules: {
              localIdentName: isProd
                ? `[local]_[hash:base64:4]`
                : `[local]_[path]`,
            },
            importLoaders: 1,
            sourceMap: !isProd,
            onlyLocals: isServer,
          }),
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: isProd ? '[name].[contenthash:8].css' : '[name].css',
        chunkFilename: isProd ? '[name].[contenthash:8].css' : '[name].css',
      }),
    ],
  };
}
