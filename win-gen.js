//Use this as a way to load in the entire library
(function(exports, selfBrowser, isBrowser){

    var generator = exports;


    var libraryName = 'win-gen';
    var common;

    if(isBrowser)
    {
        common = this['common'];
        if(!common){
            this['common'] = {};
            common = this['common'];
        }
    }
    else
        common = exports;

    //going to require the API object -- in order to make initial load request
    //might need to fix for browser stuff
//    var winapi = isBrowser ? common['win-api'] : require('../win-api/win-api.js');


    var libraryScripts =
    {
        //load in neat things
        //help first
        'win' : "/main/win.js",
        'mainGenerator' : "/generator/mainGenerator.js"
    };

    var pluginTypes =
    [
        "NEAT",
        "Generic",
        "Image"
    ];

    var defaultPluginLocations =
    [
        '/plugins/NEAT/neatPlugin.js',
        '/plugins/Generic/genericPlugin.js',
        '/plugins/Image/imagePlugin.js'
    ];

    var defaultParameterLocations =
        [
            '/plugins/NEAT/neatParameters.json'
        ];

    //we export our scripts!
    if(!common.scripts)
        common.scripts = {};

    if(common.asyncLoaded === undefined)
        common.asyncLoaded = false;

    if(!common.plugins)
        common.plugins = {};

    if(!common.parameters)
        common.parameters = {};


    if(!isBrowser)
    {
        //use nodejs to find all js files, and update them
        var fs = require('fs'),
            path = require('path');

        libraryScripts = {};

        var homeDirectory  = __dirname;
        var directoryCount = 0;

        var ignoreList =
            [
                'test',
                'node_modules',
                '.git',
                '.idea',
                'cppnjs'
            ];

        var shouldIgnore = function(fileName)
        {
            for(var i=0; i < ignoreList.length; i++)
            {
                if(fileName.indexOf(ignoreList[i]) !== -1)
                    return true;
            }
            return false;
        };

        var isJavascript = function(fileName)
        {
            return fileName.substr(fileName.length - 3, 3) === '.js';
        };

        var recursiveReadDirectorySync = function(directoryPath, builtDirectory, finished)
        {
            directoryCount++;
            var files = fs.readdirSync(directoryPath);

            files.forEach(function(f)
            {
                if(fs.lstatSync(path.resolve(directoryPath, f)).isDirectory())
                {
                    //we're a directory, but not node modules or test directory, please investigate!
                    //we should make sure we're not in our .gitignore list!
                    if(!shouldIgnore(f))
                    {
                        recursiveReadDirectorySync(path.resolve(directoryPath, f), builtDirectory + f + '/', finished);
                    }
                }
                else
                {
                    //are we a js file?
                    if(isJavascript(f))
                    {
                        var nojs = f.replace('.js','');
                        libraryScripts[nojs] = builtDirectory + f
                    }
                }

            });

            directoryCount--;
        };

        //we load up our libraries synchronously when we first start
        recursiveReadDirectorySync(homeDirectory, '/');

    }
    else
    {
        if(!common.libraries)
            common.libraries = {};

        common.libraries[libraryName] = libraryScripts;
    }



    common.scripts[libraryName] = libraryScripts;

    common.loadLibraryFile = function(library, script)
    {
        //we're in nodejs
        if(!isBrowser)
        {
            //if we haven't loaded this library, require it using our script objects
            if(!common[library])
                common[library] = {};

            if(!common[library][script])
                common[library][script] = require('.' + common.scripts[library][script]);

            //otherwise return cached objects
            return common[library][script];
        }
        else
        {
            //we assume you've called async load libraries, in which case if you didn't we fail silently
            //better quicker than slower, only need 1 call to load library
            if(!selfBrowser[library])
                return undefined;

            //easy, return the library and script from this object
            //might be undefined, but that will be handled later anyways
            return selfBrowser[library][script];
        }
    };


    if(!common.asyncLoadLibraries)
    {


        common.asyncLoadLibraries = function(relativeLocations, callback)
        {
            common.asyncLoaded = true;
            //we use jquery for loading our scripts
            if(isBrowser)
            {
                if(common.isLoaded)
                    return;

                var libraries = common.libraries;

                //how many scripts to load?
                var scriptCount = 0;
                for(var library in libraries){
                    for(var key in libraries[library])
                    {
                        scriptCount++;
                    }
                }

                for(var library in libraries){

                    var relLocation = relativeLocations[library];
                    if(!relLocation)
                    {
                        console.log('Have library, but not loading it: ' + library);
                        continue;
                    }


                    for(var script in libraries[library])
                    {

                        $.getScript(relLocation + libraries[library][script])
                            .done(function(scriptString) {
                                scriptCount--;
                                if(scriptCount ==0)
                                {
                                    //for each of our loaded modules, we must check dependencies
                                    for(var lib in libraries){
                                        for(var sc in libraries[lib]){
                                            if( selfBrowser[lib][sc] &&
                                                selfBrowser[lib][sc].CheckDependencies !== undefined)
                                                selfBrowser[lib][sc].CheckDependencies();
                                        }
                                    }

                                    common.isLoaded = true;

                                    //huzzah! We got em all, away we go!
                                    callback();
                                }
                            })
                            .fail(function(jqxhr, settings, exception) {
                                //ajax hanlder error
                                callback("Ajax handler error: " + exception);
                            });
                    }
                }
            }
        };
    }

    var initializePlugins = function(winRegister, dirs, finished)
    {
//        console.log('Loaded: ');
//        console.log(dirs);
//        console.log(common.plugins);
        var pluginsLoaded = dirs.length;

        //we're done with all our plugins and paramters
        //time to initialize
        for(var i=0; i <dirs.length; i++)
        {
            var f = dirs[i];

            if(common.plugins[f])
            {
                console.log('Loading: ' + f);

                if(common.plugins[f].checkDependencies)
                    common.plugins[f].checkDependencies();

                //register synchonously -- very easy
                common.plugins[f].registerWithWIN(winRegister);

                //plugins must have initialization procedures
                common.plugins[f].pluginInitialization(common.parameters[f], function()
                {
                    pluginsLoaded--;
                    if(pluginsLoaded <= 0)
                    {
                        //finished loading libraries gee golly!
                        finished();
                    }

                });
            }
        }
    };
    //Here is where we do initialize win generator
        //here we go -- need to use browser awareness for loading
        var nodeLoadWINGenerator = function(winRegister, prepend, plugins, completed)
        {

                    //TODO: very messy -- too messy
                //we have a schema object, and a seed object -- we need to store these things



                //we're going to go through and check on all of the plugins by default
                //we'll be custom plugin aware soon

                var readPluginsInDirectory = function(pluginDirectory, finished)
                {
                    fs.readdir(pluginDirectory, function(err, dirs){
                        if(err)
                            throw new Error(err);

                        console.log(dirs);

                        var pluginsLoaded = 0;

                        dirs.forEach(function(f)
                        {
                            //we're checking for plugin objects -- that's what we'll be loading in node

                            if(fs.lstatSync(path.resolve(pluginDirectory, f)).isDirectory())
                            {
                                var pluginAdd= './' + f.toLowerCase() + 'Plugin.js';
                                var paramterAdd = './' + f.toLowerCase() + 'Parameters.json';
                                //we're a directory, but not node modules or test directory, please investigate!
                                //we should make sure we're not in our .gitignore list!
                                if(!shouldIgnore(f))
                                {
                                    var plugPath = path.resolve(pluginDirectory, f, pluginAdd);
                                    common.plugins[f] = require(plugPath);
                                    pluginsLoaded++;
                                }

                                var paramPath = path.resolve(pluginDirectory, f, paramterAdd);

                                //does the file exist???
                                if(fs.existsSync(paramPath))
                                {
                                    //read in parameter files!
                                    var params = fs.readFileSync(paramPath);

                                    common.parameters[f] = JSON.parse(params);
                                }
                            }

                        });

                        initializePlugins(winRegister, dirs, finished);
                    });


                };

                var defaultPluginDirectory = path.resolve(__dirname, "./plugins");

                readPluginsInDirectory(defaultPluginDirectory, function()
                {
                    //finished our default loading
                    //if that's already done, we check to see if we need custom plugins
                    if(plugins && typeof plugins === 'string' && plugins !== "")
                    {
//                        console.log(plugins);
                        //read our custom plugins
                        readPluginsInDirectory(plugins, function()
                        {
                            completed();
                        });
                    }
                    else
                        completed();
                });

        };

        var browserLoadWINGenerator = function(winRegister, prepend, plugins, completed)
        {

            var pluginCalls = defaultPluginLocations.length;

            for(var i=0; i < defaultPluginLocations.length; i++)
            {
                var dLocation = prepend + defaultPluginLocations[i];

                console.log('Looking for: ' + dLocation);
                $.getScript(dLocation)
                    .done(function(scriptString) {
                        pluginCalls--;
                        if(pluginCalls ==0)
                        {
                           //ready to load paramters

                            var lowerPlugins = [];

                            for(var ix =0; ix < pluginTypes.length; ix++)
                            {
                                var pType = pluginTypes[ix].toLowerCase();
                                lowerPlugins.push(pType);

                                //load up our script object for all plugins!
                                common.plugins[pType] = common.loadLibraryFile('win-gen', pType);
                            }

                            var parameterCalls = defaultParameterLocations.length;

                            for(var p=0; p < defaultParameterLocations.length; p++)
                            {
                                var pFile = prepend + defaultParameterLocations[p];

                                $.getJSON(pFile, function(data)
                                {
                                    if(!data.plugin){
                                        console.log(data);
                                        throw new Error("Parameter file doesn't have identifying paramter object, needed for browser load -- add 'plugin: pluginName' to json!");
                                    }

                                    common.parameters[data.plugin.toLowerCase()] = data;

                                    parameterCalls--;

                                    if(parameterCalls == 0)
                                    {

                                        //all params loaded, and we're ready to initalize plugins
                                        initializePlugins(winRegister, lowerPlugins, completed);
                                    }
                                });
                            }
                        }
                    })
                    .fail(function(jqxhr, settings, exception) {
                        //ajax hanlder error
                        throw new Error("wingen browser ajax handler error: " + exception);
                    });
            }
        };



//accessed from outside
    generator.initializeWINGenerator = function(prepend, plugins, completed)
    {
        prepend = prepend || '';
        plugins = plugins || {};

        if(typeof prepend == 'function')
        {
            completed = prepend;
            prepend = '';
            plugins = {};
        }
        //if we pass in just a callback function -- make sure to handle that -- gonna happen possible if plugins are empty
        else if(typeof plugins === 'function')
        {
            completed = plugins;
            plugins = {};
        }


        //everything needs to be loaded up -- fail otherwise
        if(isBrowser && !Object.keys(common.libraries).length)
            throw new Error("You can't load win-gen library before async evolution loading in browser!");


        var winapi = isBrowser ? common : require('win-api');
        var winsaveAPI = winapi.loadLibraryFile('win-api', 'win-save');

        winsaveAPI.initialSchemaAndSeed(function(schemaAndSeed){

                //load our register object
                var winRegister = common.loadLibraryFile('win-gen', 'win');

                //object is already parsed to json, just access the objects
                winRegister.registerSchemaTypes(schemaAndSeed.schema);
                winRegister.registerSeeds([schemaAndSeed.seed]);
                winRegister.registerDefaultPaths(schemaAndSeed.default);

                if(isBrowser)
                    browserLoadWINGenerator(winRegister, prepend, plugins, completed);
                else
                    nodeLoadWINGenerator(winRegister, prepend, plugins, completed);

            },
            function(err)
            {
                console.log('Initial schema and seed fail in win-gen')
                throw new Error(err);
            });
    };




    //send in the object, and also whetehr or not this is nodejs
})(typeof exports === 'undefined'? this['win-gen']={}: exports, this, typeof exports === 'undefined'? true : false);


