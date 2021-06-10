/*
 * Copyright (c) 2021. Andrew Ealovega
 */
const path = require('path');
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
    entry: {
        'main': './src/index.ts',
        'serviceWorker': './src/serviceWorker.ts'
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
    },
    plugins: [
      new CopyWebpackPlugin({
          patterns: [
              {
                  from: "index.html",
                  to: "index.html"
              }
          ]
      }),
    ],
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
};
