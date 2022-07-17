const path = require('path');

module.exports = {
    entry: './typescript/entry.ts',
    mode: "development",
    devtool: "inline-source-map",
    output: {
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist'),
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js"]
    },
    module: {
        rules: [
            { 
                exclude: /node_modules/,
                test: /\.tsx?$/, 
                loader: "ts-loader",
            }
        ]
    },
    devServer: {
        static: __dirname,
        port: 8080,
    }
};
