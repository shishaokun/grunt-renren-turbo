# grunt-renren-turbo

> Local JS/CSS server

## Getting Started
This plugin requires Grunt `~0.4.2`

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins. Once you're familiar with that process, you may install this plugin with this command:

```shell
npm install grunt-renren-turbo --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-renren-turbo');
```

## The "renren_turbo" task

### Overview
In your project's Gruntfile, add a section named `renren_turbo` to the data object passed into `grunt.initConfig()`.

```js
grunt.initConfig({
  renren_turbo: {
    options: {
      // Task-specific options go here.
    },
    your_target: {
      // Target-specific file lists and/or options go here.
    },
  },
});
```

### Options

#### options.base
Type: `String`
Default value: `'./'`

Path to workspace.

#### options.port
Type: `Number`
Default value: `7070`

The port on which the webserver will respond.

### Usage Examples

#### Typical use
In this example, set a custom workspace(contains git/hg repos) path, and use the default port(7070) for respond.
This plugin don't need to specify files.

```js
grunt.initConfig({
  renren_turbo: {
    options: {
      base: 'd:/workhome/workspace'
    },
    files: {},
  },
});
```

## Contributing
In lieu of a formal styleguide, take care to maintain the existing coding style. Add unit tests for any new or changed functionality. Lint and test your code using [Grunt](http://gruntjs.com/).

## Release History
_(Nothing yet)_
