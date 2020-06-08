const webpack = require('webpack')

/*const d3 = {
  ...require('d3-scale-chromatic'),
};*/

module.exports = {
  configureWebpack: {
    plugins: [
      new webpack.ProvidePlugin({
        mapboxgl: 'mapbox-gl',
      }),
      new webpack.ProvidePlugin({
        d3: 'd3-scale-chromatic',
      }),
    ],
  },
}