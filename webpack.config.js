const webpack = require('webpack');
const { merge } = require('webpack-merge');
const path = require('path');

const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const TARGET = process.env.npm_lifecycle_event;

const PATHS = {
  app: path.join(__dirname, 'src'),
  build: path.join(__dirname, 'build'),
};

process.env.BABEL_ENV = TARGET;

const common = {
  entry: {
    background: path.join(PATHS.app, 'background.js'),
    injector: path.join(PATHS.app, 'injector.js'),
    flash: path.join(PATHS.app, 'flash.js'),
  },
  resolve: {
    extensions: ['.js', '.jsx'],
  },
  output: {
    chunkFilename: '[name].bundle.js',
    path: PATHS.build,
    filename: '[name].js',
    publicPath: '/',
  },
  optimization: {
    runtimeChunk: false,
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: {
          loader: 'babel-loader?cacheDirectory',
        },
        include: PATHS.app,
      },
    ],
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { from: 'static' },
      ],
    }),
    new HtmlWebpackPlugin(),
  ],
};

const publicPath = `http://${process.env.HOST || 'localhost'}:${process.env.PORT || 8080}/`;

// Default configuration
if (TARGET === 'start' || !TARGET) {
  module.exports = merge(common, {
    devtool: false,
    externals: [
      'bindings',
    ],
    mode: 'development',
    output: {
      publicPath,
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': '"development"',
      }),
      new webpack.HotModuleReplacementPlugin(),
    ],
  });
}

if (TARGET === 'build' || TARGET === 'build:ci') {
  module.exports = merge(common, {
    devtool: 'source-map',
    mode: 'production',
    module: {
      rules: [
        {
          test: /\.s?css$/,
          use: [
            'css-loader',
            'sass-loader',
          ],
        },
      ],
    },
    output: {
      path: PATHS.build,
      filename: '[name].[chunkhash].js',
      chunkFilename: '[name].[chunkhash].js',
      sourceMapFilename: '[name].[chunkhash].js.map',
    },
  });
}
