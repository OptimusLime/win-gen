//For organizing callbacks for artifacts
//also loads in plugins here

    var win = {};

    var wmath = require('win-utils').math;

    module.exports = win;

    var pathFunctions = {};
    var typeFunctions = {};
    var conversionPaths = {};

    var schemaTypes;
    var referencePaths;
    var artifactSeeds = [];
    var defaultPaths;

    //return random int < max

    //need a function that fetches schema types from WIN server on load!
    win.registerSchemaTypes = function(schemas)
    {
        schemaTypes = schemas;
    };
    //need a function that fetches schema types from WIN server on load!
    win.registerReferenceTypes = function(references)
    {
        referencePaths = references;
    };

    win.registerSeeds = function(seeds)
    {
        artifactSeeds = artifactSeeds ? artifactSeeds.concat(seeds) : seeds;
    };

    //default additions to every schema type!
    win.registerDefaultPaths = function(defaults)
    {
        defaultPaths = defaults;
    };

    //send clone of seeds (shallow copy)
    win.allSeeds = function()
    {
        return artifactSeeds.slice(0);
    };
    win.randomSeed = function()
    {
        if(artifactSeeds && artifactSeeds.length)
            return artifactSeeds[wmath.next(artifactSeeds.length)];
    };

    win.registerConversionFunctions = function(path, convertToLocal, convertToDB)
    {
        conversionPaths[path] = {toLocal: convertToLocal, toDB: convertToDB};
    };

    win.registerCallbackForSchemaPath = function(path, parentCB, arrayCB, finalCB)
    {
        //there can only be one!
        pathFunctions[path] = {parent: parentCB, array: arrayCB, final: finalCB};
    };
    win.registerCallbackForSchemaType = function(type, parentCB, arrayCB, finalCB)
    {
        //only one per type!
        typeFunctions[type] = {parent: parentCB, array: arrayCB, final: finalCB};
    };

    win.getSchemaTypes = function()
    {return schemaTypes;};


    var defaultParentBehavior = function(creationObject, path, childCount, parentObjects, schema)
    {
        //default behavior is to select object from one of the parents, for however many children
        //and just send that object back untouched

        var offspring = [];
        var responsible = {};

        for(var i=0; i < childCount; i++)
        {

            var chosen = wmath.next(parentObjects.length);
            responsible[chosen] = true;

            //copy object and use as child
            var childObject = parentObjects[chosen];
            offspring.push(childObject);
        }
        var parents= [];
        for(var key in responsible)
            parents.push(key);

        return {offspring: offspring, parents: parents};
    };

    var defaultArrayBehavior = function(creationObject, path, childCount, parentObjects)
    {
        //default behavior is to select one parent, and send back exactly that parent (or however children are defined for that parent
        //e.g. asexual reproduction, or just inheriting the exact thing
        return [{count: 0, selection: "|"}];
    };

    var defaultFinalBehavior = function(offspring, parents)
    {

    };

    win.fetchConvertFunction = function(path)
    {
        return conversionPaths[path];
    };

    win.fetchPathFunction = function(path)
    {
        return pathFunctions[path];
    };

    win.fetchTypeFunction = function(type)
    {
        return typeFunctions[type];
    };

    win.isDefaultPath = function(path)
    {
        if(path.indexOf('.') == -1)
        {
            for(var key in defaultPaths)
                if(path === key)
                    return true;

            //we aren't any of those guys!
            return false;
        }
        else
        {
            var finalPath = path.substr(path.lastIndexOf('.') + 1);
//            console.log('Checking final: ' + finalPath);

            for(var key in defaultPaths)
                if(finalPath === key)
                    return true;

            //we aren't any of those guys!
            return false;
        }
    };

    win.onlySchemaToStateAndCB = function(path, innerSchema)
    {
//        console.log('Checking: ');
//        console.log(path);
//        console.log(innerSchema);
//        console.log('end chk');
        var state;
        var callbacks;

        //if we're a default path, no point in actually making copies (parents, wid, dbType -- doesn't make sense)
        if(win.isDefaultPath(path))
        {
            state = "ignore";
            callbacks = null;
        }
        else if(typeof innerSchema === 'string')
        {
            state = "simple";
            callbacks = win.fetchTypeFunction(innerSchema);
        }
        else if(innerSchema['type'] && !innerSchema['ref'])
        {
            state = "simple";
            callbacks = win.fetchTypeFunction(innerSchema['type']);
        }
        else if(innerSchema['type'] && innerSchema['ref']){
            state = "reference";

            //grab callbacks for the reference type, not the type (string)
            callbacks = win.fetchTypeFunction(innerSchema['ref']);

            //change the inner schema -- after we fetch our callbacks!!!
            innerSchema = schemaTypes[innerSchema['ref']];
        }
        else
        {
            state = "complex";
            callbacks = {array: defaultArrayBehavior, parent: defaultParentBehavior, final: defaultFinalBehavior};
        }

        if((state == "reference" || state == "simple") && !callbacks){
            console.log('Schema error - state: ' + state);
            console.log(innerSchema);
            throw new Error("Callback not defined for reference type(!): " + innerSchema + ' path: ' + path + ' state: ' + state);
        }

        return {state: state, callbacks:callbacks};
    };
    win.pathOrSchemaStateAndCallbacks = function(path, innerSchema)
    {

        var state;
        var callbacks = win.fetchPathFunction(path);

        if(!callbacks)
        {
            return win.onlySchemaToStateAndCB(path, innerSchema);
        }

        //if we made it here, it means we HAVE a path object
        return {state: "path", callbacks:callbacks};
    };
