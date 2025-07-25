const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// Liste des pages de l'application avec fichiers HTML associés
const pages = [
  'index',
  'dashboard',
  'routers',
  'router-dashboard',
  'clients',
  'payments',
  'wifi-codes',
  'router-settings',
  'buy-code',
  'profilbuy-code',
  'settings',
  'license-modal'
];

// Liste des modules JS sans fichier HTML associé
const jsModules = [
  'license-utils'
];

module.exports = {
  // Points d'entrée
  entry: function() {
    // Objet pour stocker toutes les entrées
    const entries = {
      // Point d'entrée principal
      index: './src/index.js'
    };
    
    // Ajouter explicitement buy-code.js
    if (require('fs').existsSync('./buy-code.js')) {
      entries['buy-code'] = './buy-code.js';
      console.log('Entrée explicite ajoutée pour buy-code.js');
    } else {
      console.error('ERREUR: buy-code.js introuvable!');
    }
    
    // Ajouter explicitement profilbuy-code.js
    if (require('fs').existsSync('./profilbuy-code.js')) {
      entries['profilbuy-code'] = './profilbuy-code.js';
      console.log('Entrée explicite ajoutée pour profilbuy-code.js');
    } else {
      console.error('ERREUR: profilbuy-code.js introuvable!');
    }
    
    // Ajouter explicitement license-modal.js
    if (require('fs').existsSync('./license-modal.js')) {
      entries['license-modal'] = './license-modal.js';
      console.log('Entrée explicite ajoutée pour license-modal.js');
    } else {
      console.error('ERREUR: license-modal.js introuvable!');
    }
    
    // Ajouter explicitement license-utils.js
    if (require('fs').existsSync('./license-utils.js')) {
      entries['license-utils'] = './license-utils.js';
      console.log('Entrée explicite ajoutée pour license-utils.js');
    } else {
      console.error('ERREUR: license-utils.js introuvable!');
    }
    
    // Ajouter les autres pages avec HTML associé
    pages.forEach(page => {
      if (page !== 'index') { // Éviter la duplication de l'entrée index
        const fs = require('fs');
        if (fs.existsSync(`./${page}.js`)) {
          entries[page] = `./${page}.js`;
          console.log(`Fichier trouvé et ajouté à l'entrée: ./${page}.js`);
        } else if (fs.existsSync(`./src/${page}.js`)) {
          entries[page] = `./src/${page}.js`;
          console.log(`Fichier trouvé et ajouté à l'entrée: ./src/${page}.js`);
        } else {
          console.log(`Attention: Fichier JavaScript introuvable pour la page ${page}`);
        }
      }
    });
    
    // Ajouter les modules JS sans fichier HTML associé
    jsModules.forEach(module => {
      const fs = require('fs');
      if (fs.existsSync(`./${module}.js`)) {
        entries[module] = `./${module}.js`;
        console.log(`Module JS trouvé et ajouté à l'entrée: ./${module}.js`);
      } else if (fs.existsSync(`./src/${module}.js`)) {
        entries[module] = `./src/${module}.js`;
        console.log(`Module JS trouvé et ajouté à l'entrée: ./src/${module}.js`);
      } else {
        console.log(`Attention: Module JavaScript introuvable: ${module}`);
      }
    });
    
    console.log('Entrées configurées:', Object.keys(entries));
    return entries;
  }(),

  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/'  // Modifié pour utiliser la racine comme chemin public
  },

  // Configuration des polyfills pour les modules Node.js
  resolve: {
    fallback: {
      "vm": require.resolve("vm-browserify"),
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "http": require.resolve("stream-http"),
      "https": require.resolve("https-browserify"),
      "zlib": require.resolve("browserify-zlib"),
      "path": require.resolve("path-browserify"),
      "fs": false,
      "os": require.resolve("os-browserify/browser"),
      "constants": require.resolve("constants-browserify")
    }
  },

  // Configuration du serveur de développement
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
      watch: true
    },
    compress: true,
    port: 9000,
    hot: true,
    historyApiFallback: true
  },

  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: ['@babel/plugin-transform-runtime']
          }
        }
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader'
        ]
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'images/[name][ext]'
        }
      }
    ]
  },

  plugins: [
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({
      filename: '[name].css'
    }),
    // Fournir des variables globales pour les modules qui en ont besoin
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),

    // Génération des fichiers HTML uniquement pour les pages avec HTML associé
    ...pages.map(page => {
      console.log(`Configuration pour la page ${page}`);
      
      // Configuration spéciale pour buy-code.html
      if (page === 'buy-code') {
        console.log('Configuration spéciale pour buy-code.html');
        return new HtmlWebpackPlugin({
          template: './buy-code.html',
          filename: 'buy-code.html',
          chunks: ['buy-code'],
          inject: 'body',
          scriptLoading: 'blocking'
        });
      }
      
      // Configuration spéciale pour profilbuy-code.html
      if (page === 'profilbuy-code') {
        console.log('Configuration spéciale pour profilbuy-code.html');
        return new HtmlWebpackPlugin({
          template: './profilbuy-code.html',
          filename: 'profilbuy-code.html',
          chunks: ['profilbuy-code'],
          inject: 'body',
          scriptLoading: 'blocking'
        });
      }
      
      // Configuration spéciale pour license-modal.html
      if (page === 'license-modal') {
        console.log('Configuration spéciale pour license-modal.html');
        return new HtmlWebpackPlugin({
          template: './license-modal.html',
          filename: 'license-modal.html',
          chunks: ['license-modal'],
          inject: false // Pas d'injection automatique car chargé dynamiquement
        });
      }
      
      // Configuration standard pour les autres pages
      return new HtmlWebpackPlugin({
        template: `./${page}.html`,
        filename: `${page}.html`,
        chunks: [page],
        inject: true
      });
    }),

    // Copie des fichiers statiques
    new CopyWebpackPlugin({
      patterns: [
        { 
          from: 'style.css',
          to: 'style.css',
          noErrorOnMissing: true
        },
        {
          from: 'assets',
          to: 'assets',
          noErrorOnMissing: true
        },
        {
          from: 'components',
          to: 'components',
          noErrorOnMissing: true
        },
        {
          from: 'manifest.json',
          to: 'manifest.json',
          noErrorOnMissing: true
        },
        {
          from: 'service-worker.js',
          to: 'service-worker.js',
          noErrorOnMissing: true
        },
        {
          // Création du dossier pour les icônes PWA
          from: 'js/pwa-installer.js',
          to: 'js/pwa-installer.js',
          noErrorOnMissing: true
        }
      ]
    })
  ],

  resolve: {
    fallback: {
      "crypto": require.resolve("crypto-browserify"),
      "stream": require.resolve("stream-browserify"),
      "buffer": require.resolve("buffer/"),
      "path": false,
      "fs": false
    }
  }
};