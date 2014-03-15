(function(exports, selfBrowser, isBrowser){

    //This will get loaded in as a plugin object

    //needs to register itself inside of WIN
    //this should be done in a manner that can be easily replicated in other languages
    var imagePlugin = exports;

    //return random int < max
    var next = function(max)
    {
        return Math.floor(Math.random()*max);
    };

    //TODO: Plugins must be objects that are created, then initialized
    //TODO: each plugin object will be assigned to a path
    //--when you call for a type plugin, it will fetch object from path and return that object's callbacks
    imagePlugin.pluginInitialization = function(parameterFile, finished)
    {
        //done -- when we fetch seeds, we'll finish when we finish grabbing seeds
        setTimeout(finished,0);

    };
    imagePlugin.registerWithWIN = function(winRegister)
    {
        //we can register our information now
        winRegister.registerCallbackForSchemaType('image', imagePlugin.handleImageOffspringCreation, imagePlugin.handleImageArrays, imagePlugin.handleFinalOffspringObjects);
        winRegister.registerConversionFunctions('image', imagePlugin.convertDBObjectToType, imagePlugin.convertTypeToDBObject);
    };

    imagePlugin.handleImageArrays = function(creationObject, path, childCount, parentObjects)
    {
//        console.log(arguments);
        //so we handle rows this way:
        //if you have an array of images --
        //it can't be guaranteed that images of vastly different genotypes in those arrays would actually make any sense
        //therefore, at each row, you choose a single parent from the list of images

        var variousLengths = [];
        for(var i=0; i < parentObjects.length; i++)
        {
            var pLength = parentObjects[i].length;
            variousLengths.push(pLength);
        }

        var selections = [];
        for(var i=0; i < childCount; i++)
        {
            var arrayLength = variousLengths[next(variousLengths.length)];
            selections.push({count: arrayLength, selection: "#"});
        }

        return selections;
    };


    //simple stuff here, just return one of the parent objects
    imagePlugin.handleImageOffspringCreation = function(creationObject, path, childCount, parentObjects, schema)
    {
        //now we have the parents

        var finalOffspring = [];
        var finalParents = {};

        for(var c=0; c < childCount; c++)
        {
            var parentIx = next(parentObjects.length);
            var parentImage = parentObjects[parentIx];

            //grab the actual genome

            var offspring = {};
            for(var key in parentImage)
            {
                offspring[key] = parentImage[key];
            }

            //images don't have parents -- they just are themselves
//            var pIDs = [parentObjects[parentIx].wid];
            //mark the wids of the parents
//            offspring.parents = pIDs;

            //push the offspring (now complete with proper WID and parental references!
            finalOffspring.push(offspring);

            //note the parents involved
            finalParents[c] = [parentIx];
        }

        return {offspring: finalOffspring, parents: finalParents};
    };

    imagePlugin.handleFinalOffspringObjects = function(offspring, parents)
    {
        console.log(arguments);
    };
    //we need a function that can convert an incoming database object into a neat genotype
    imagePlugin.convertDBObjectToType = function(dbObject)
    {
        //simple -- just return image object -- nothing special here
        return dbObject;
    };

    //this converts a genotype into a database object with the current schema
    //this is how it would be done for a standard neat genotype
    //if it's significantly custom genotype, you'd replace this code
    imagePlugin.convertTypeToDBObject = function(typeObject)
    {
        //traditionally, this is quite easy actually -- don't do shit
        return typeObject;
    };


})(typeof exports === 'undefined'? this['win-gen']['image']={}: exports, this, typeof exports === 'undefined'? true : false);
