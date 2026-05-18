  module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Required for module resolver
      [
        'module-resolver',
        {
          alias: {
            '@': './',
            '@components': './components',
            '@constants': './constants',
            '@utils': './utils',
          },
          extensions: ['.js', '.jsx', '.ts', '.tsx'],
        },
      ],
      // Required for TensorFlow.js
      '@babel/plugin-proposal-export-namespace-from',
      'react-native-reanimated/plugin',
      ['react-native-worklets-core/plugin'],
    ],
  };
}; 