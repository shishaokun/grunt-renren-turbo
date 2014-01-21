/*
 * grunt-renren-turbo
 * https://github.com/viclm/grunt-renren-turbo
 *
 * Copyright (c) 2014 ming.liu
 * Licensed under the MIT license.
 */

'use strict';

//var connect = require('connect');
var async = require('async');
var http = require('http');
var url = require('url');
var fs = require('fs');
var pathOrg = require('path');
var path = {
    normalize: function (p) {
        return pathOrg.normalize(p).split(pathOrg.sep).join('/');
    },
    join: function (p/*, p2, p3 ...*/) {
        return pathOrg.join.apply(pathOrg, arguments).split(pathOrg.sep).join('/');
    }
};
var xml2js = require('xml2js');
var grunt;

var $maps = {};

var collectMaps = function (path, callback) {
    path = path.replace(/\/?$/, '/');
    fs.readdir(path, function (err, files) {
        files = files.filter(function (f) {
            return f.charAt(0) !== '.';
        });
        async.each(files, function (f, cb) {
            fs.stat(path + f, function (err, stats) {
                if (stats.isFile()) {
                    if (f === 'template-config.xml') {
                        fs.readFile(path + f, {encoding: 'utf-8'}, function (err, data) {
                            data = data.match(/url="([^"]+)"/);
                            if (data) {
                                $maps[data[1]] = path;
                            }
                            cb();
                        });
                    }
                    else {
                        cb();
                    }
                }
                else if (stats.isDirectory()) {
                    collectMaps(path + f + '/', cb);
                }
                else {
                    cb();
                }
            });
        }, callback);
    });
};

var findPackage = function (path) {
    var filename;
    path = path.replace(/[^\/]+$/, '');
    while (path !== '/') {
        if (fs.existsSync(path)) {
            filename = fs.readdirSync(path);
            filename = filename.filter(function (f) {return f === '.package'});
            if (filename.length) {
                return {
                    package: fs.readFileSync(path + filename[0], {encoding: 'utf-8'}),
                    packagePath: path
                };
            }
        }
        path = path.replace(/[^\/]+\/$/, '');
    }
};

var compileJS = function (repo, pathname, callback) {
    var parser = new xml2js.Parser({async: false});
    parser.parseString(fs.readFileSync(repo + 'template-config.xml', {encoding: 'utf-8'}), function (err, result) {
        try {
            var combineList = {}, fileStr;
            if (result.package.source[0].combine) {
                result.package.source[0].combine.forEach(function (combine) {
                    combineList[combine.$.path] = combine.include;
                });
            }
            if (combineList[pathname]) {
                fileStr = (function concatIncludeList (includeList) {

                    return includeList.map(function (filepath) {
                        var fileStr = '';
                        if (filepath.$.module) {
                            filepath = filepath.$.module;
                            fileStr = fs.readFileSync(path.join(repo, 'src/node_modules', filepath), {encoding: 'utf-8'});
                            if (/\.mustache$/.test(filepath)) {
                                fileStr = ";object.define('xn/" +
                                    repo.match(/[^\/]+\/$/)[0] +
                                    filepath +
                                    "', function(require, exports, module) {return '" +
                                    fileStr.replace(/[\r\n]/g, '') +
                                    "';});";
                            }
                            fileStr = '/* from: ' + path.join(repo, 'src/node_modules', filepath) + ' */\n' + fileStr;
                        }
                        else {
                            filepath = filepath.$.path;
                            var hasLib = filepath.match(/^\.\.\/lib\/([^\/]+)\/(.+)$/);
                            if (hasLib) {
                                var map = result.package.library[0].folder || [];
                                map = map.filter(function (folder) {return folder.$.name === hasLib[1];});
                                map = map[0] ? map[0].$.url : undefined;
                                map = $maps[map];
                                if (map) {
                                    filepath = hasLib[2].replace(/^(src\/)?/, function (str, p) {return p ? '' : '../'; });
                                    compileJS(map, filepath, function (err, data) {
                                        if (data) {
                                            fileStr = data;
                                        }
                                        else {
                                            fileStr = '/* from: ' + path.join(map, 'src', filepath) + ' */\n';
                                        }
                                    });
                                }
                                else {
                                    filepath = path.join(repo, 'src', filepath);
                                    if (fs.existsSync(filepath)) {
                                        fileStr = fs.readFileSync(filepath, {encoding: 'utf-8'});
                                    }
                                    else {
                                        grunt.log.error('错误的路径: ' + filepath);
                                    }
                                    fileStr = '/* from: ' + filepath + ' */\n' + fileStr;
                                }
                            }
                            else if (combineList[filepath]) {
                                fileStr = concatIncludeList(combineList[filepath]);
                            }
                            else if (filepath.indexOf('*') > -1) {
                                fileStr = grunt.file.expand(path.join(repo, 'src', filepath)).map(function (f) {
                                    return fs.readFileSync(f);
                                }).join('\n');
                            }
                            else {
                                filepath = path.join(repo, 'src', filepath);
                                if (fs.existsSync(filepath)) {
                                    fileStr = fs.readFileSync(filepath, {encoding: 'utf-8'});
                                }
                                else {
                                    grunt.log.error('错误的路径: ' + filepath);
                                }
                                fileStr = '/* from: ' + filepath + ' */\n\n' + fileStr;
                            }
                        }
                        return fileStr;
                    }).join('\n');

                })(combineList[pathname]);

                callback(null, fileStr);
                return;
            }
        }
        catch (e) {
            console.log(e);
            grunt.log.error('template-config.xml格式错误');
            callback({code: 502, message: 'template-config.xml格式错误'});
            return;
        }

        var filepath = path.join(repo, 'src/', pathname);
        if (fs.existsSync(filepath)) {
            fileStr = '/* from: ' + filepath + ' */\n' + fs.readFileSync(filepath, {encoding: 'utf-8'});
            callback(null, fileStr);
        }
        else {
            callback({code: 404});
        }

    });
};

var compileCSS = function (repo, pathname, callback) {
    var filepath = path.join(repo, 'src/', pathname),
        readfile = function (filepath, stack) {
            if (stack.indexOf(filepath) > -1) {
                grunt.log.error('循环的路径: ' + filepath);
                return '';
            }
            else {
                stack.push(filepath);
            }
            return fs
                    .readFileSync(filepath, {encoding: 'utf-8'})
                    .replace(/^@import\surl\(["']?([^"'\(\)]+)["']?\);/mg, function (str, p) {

                p = path.join(filepath.replace(/[^\/]+$/, ''), p);
                if (p.indexOf(repo) === 0) {
                    if (fs.existsSync(p)) {
                        return '/* from: ' + p + ' */\n' + readfile(p, stack);
                    }
                    else {
                        grunt.log.error('错误的路径: ' + p);
                        return '/* ' + p + '不存在 */\n';
                    }
                }
                else {
                    var res;
                    compileCSS(p.slice(0, p.indexOf('src')), p.slice(p.indexOf('src') + 4), function (err, data) {
                        if (data) {
                            res = '/* from: ' + p + ' */\n' + data;
                        }
                        else {
                            grunt.log.error('错误的路径: ' + p);
                            res = '/* ' + p + '不存在 */\n';
                        }
                    });
                    return res;
                }
            });
        },
        fileStr;

    if (fs.existsSync(filepath)) {
        callback(null, '/* from: ' + filepath + ' */\n' + readfile(filepath, []));
    }
    else {
        callback({code: 404});
    }
};

var output = function (response, content, type) {
    if (typeof type === 'string') {
        response.setHeader('content-type', 'text/' + type);
    }
    else {
        response.setHeader(String(type), {'content-type': 'text/plain'});
    }
    response.write(content);
    response.end();
};

var onRequest = function (request, response) {

    var pathname = path.normalize(url.parse(request.url).pathname);
    var svnfilepath = path.normalize(request.headers['x-request-filename']);
    var fileType = /\.js$/.test(pathname) ? 'javascript' : 'css';
    var repo = findPackage(svnfilepath);
    var reg = /\//g, subpathname;
    var readFileSVN = function (type) {
        if (fs.existsSync(svnfilepath)) {
            grunt.log.ok('svn: ' + pathname);
            output(response, fs.readFileSync(svnfilepath), type);
        }
        else {
            grunt.log.error('404: ' + pathname);
            output(response, '404 Not Found', 404);
        }
    };

    if (repo && $maps[repo.package]) {

        while (reg.test(repo.packagePath)) {
            if (pathname.indexOf(repo.packagePath.slice(reg.lastIndex - 1)) === 0) {
                subpathname = pathname.slice(repo.packagePath.length - reg.lastIndex + 1);
                break;
            }
        }

        if (fileType === 'javascript') {
            compileJS($maps[repo.package], subpathname, function (err, data) {
                if (data) {
                    grunt.log.ok('hg: ' + pathname);
                    output(response, data, 'javascript');
                }
                else if (err.code === 502) {
                    grunt.log.error('502: ' + err.message);
                    output(response, err.message, 502);
                }
                else {
                    readFileSVN('javascript');
                }
            });
        }
        else if (fileType === 'css') {
            compileCSS($maps[repo.package], subpathname.replace(/-all-min(\.css)$/, '$1'), function (err, data) {
                if (data) {
                    grunt.log.ok('hg: ' + pathname);
                    output(response, data, 'css');
                }
                else {
                    readFileSVN('css');
                }
            });
        }
    }
    else {
        readFileSVN('css');
    }
};


module.exports = function(g) {

  grunt = g;

  grunt.registerMultiTask('renren_turbo', '前端开发套件', function() {

    var options = this.options({
      base: './',
      port: '7070'
    });

    grunt.log.write('\n准备工作区');

    var done = this.async();

    var timer = setInterval(function () {
        grunt.log.write('.');
    }, 200);

    async.series([
        function (callback) {
            collectMaps(options.base, function () {
                callback();
            });
        },
        function (callback) {
            http.createServer()
            .listen(options.port)
            .on('listening', function () {
                callback();
            })
            .on('request', onRequest);
        }
    ],
    function () {
        clearInterval(timer);
        grunt.log.success(' 准备完毕, 等待请求...\n');
    });

  });

};
