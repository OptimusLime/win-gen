(function(exports, selfBrowser, isBrowser){

    var win = isBrowser ? selfBrowser['common'] : require('../../win-gen.js');

    var genericPlugin = exports;

    genericPlugin.pluginInitialization = function(parameterFile, finished)
    {
        //we don't do anything for initialization
        setTimeout(finished,0);
    };
    genericPlugin.registerWithWIN = function(winRegister)
    {
        //we can register our information now
        winRegister.registerCallbackForSchemaType('String', defaultParentBehavior, defaultArrayBehavior, defaultHandleFinalOffspringObjects);
        winRegister.registerCallbackForSchemaType('Number', defaultParentBehavior, defaultArrayBehavior, defaultHandleFinalOffspringObjects);
        winRegister.registerCallbackForSchemaType('Date', defaultParentBehavior, defaultArrayBehavior, defaultHandleFinalOffspringObjects);
    };

    var next = function(max)
    {
        return Math.floor(Math.random()*max);
    };

    var defaultParentBehavior = function(creationObject, path, childCount, parentObjects, schema)
    {
        //default behavior is to select object from one of the parents, for however many children
        //and just send that object back untouched

        var offspring = [];
        var responsible = {};

        for(var i=0; i < childCount; i++)
        {

            var chosen = next(parentObjects.length);
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

    var defaultHandleFinalOffspringObjects = function(offspring, parents)
    {
        //we'll do nothing here -- we could change offspring and parents
    };

    //we need a function that can convert an incoming database object into a generic object
    genericPlugin.convertDBObjectToType = function(dbObject)
    {
       return dbObject;
    };

    //this converts a generic object into a database object with the current schema
    //this is how it would be done for a standard object
    //if it's significantly custom version, you'd replace this code
    genericPlugin.convertTypeToDBObject = function(typeObject)
    {
        //traditionally, this is quite easy actually -- don't do shit
        return typeObject;
    };

})(typeof exports === 'undefined'? this['win-gen']['generic']={}: exports, this, typeof exports === 'undefined'? true : false);
