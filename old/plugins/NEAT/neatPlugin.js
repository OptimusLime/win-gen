(function(exports, selfBrowser, isBrowser){

    //This will get loaded in as a plugin object

    //needs to register itself inside of WIN
    //this should be done in a manner that can be easily replicated in other languages
    var neatPlugin = exports;
    var win = isBrowser ? selfBrowser['common'] : require('../../win-gen.js');
    var winbase = isBrowser ?  selfBrowser['common'] : require('win-base');

    //grab cppn and neat stuff
    var cppnjs = isBrowser ? selfBrowser['common'] : require('cppn');
    var neatjs = isBrowser ? selfBrowser['common'] : require('neatjs');


    var cppnNode = cppnjs.loadLibraryFile('cppnjs', 'cppnNode');
    var neatGenome = neatjs.loadLibraryFile('neatjs', 'neatGenome');
    var neatNode = neatjs.loadLibraryFile('neatjs', 'neatNode');
    var neatConnection = neatjs.loadLibraryFile('neatjs', 'neatConnection');
    var neatParameters = neatjs.loadLibraryFile('neatjs', 'neatParameters');

    var iec = neatjs.loadLibraryFile('neatjs', 'iec');

    var cuid = winbase.loadLibraryFile('win-base', 'cuid');

    //return random int < max
    var next = function(max)
    {
        return Math.floor(Math.random()*max);
    };

    //if you have any dependencies, you should update them here
    neatPlugin.CheckDependencies = function()
    {

        cppnNode = cppnjs.loadLibraryFile('cppnjs', 'cppnNode');
        neatGenome = neatjs.loadLibraryFile('neatjs', 'neatGenome');
        neatNode = neatjs.loadLibraryFile('neatjs', 'neatNode');
        neatConnection = neatjs.loadLibraryFile('neatjs', 'neatConnection');
        neatParameters = neatjs.loadLibraryFile('neatjs', 'neatParameters');

        //pull in any cppn or neatjs dependencies here
        //will be called when looking for plugins
        iec = neatjs.loadLibraryFile('neatjs', 'iec');

        //cuid generator
        cuid = winbase.loadLibraryFile('win-base', 'cuid');
    };

    var iecGenerator;


    //TODO: Plugins must be objects that are created, then initialized
    //TODO: each plugin object will be assigned to a path
    //--when you call for a type plugin, it will fetch object from path and return that object's callbacks
    neatPlugin.pluginInitialization = function(parameterFile, finished)
    {
        //we need to grab our parameter file -- handles how we generate our genome
        //if we don't have neat parameters specified, we create a new generic paramter object
        var np = parameterFile.neatParameters || new neatParameters.NeatParameters();

        //set up the defaults here
        np.pMutateAddConnection = .13;
        np.pMutateAddNode = .13;
        np.pMutateDeleteSimpleNeuron = .00;
        np.pMutateDeleteConnection = .00;
        np.pMutateConnectionWeights = .72;
        np.pMutateChangeActivations = .02;

        np.pNodeMutateActivationRate = 0.2;
        np.connectionWeightRange = 3.0;
        np.disallowRecurrence = true;

        var mutationsOnCreation = 0;

        //then we need to go and fetch seeds from the win-save module

        //we'll go through the win-api and retrieve some seeds for artifacts in the future
        //for now - assume at least 1 parent
        var seeds = [];

            //here we know we're all loaded, and we're going to create our holder
        iecGenerator = new iec.GenericIEC(np, seeds, {postMutationCount: mutationsOnCreation});


        //done -- when we fetch seeds, we'll finish when we finish grabbing seeds
        setTimeout(finished,0);

    };
    neatPlugin.registerWithWIN = function(winRegister)
    {
        //we can register our information now
        winRegister.registerCallbackForSchemaType('NEATGenotype', neatPlugin.handleNEATOffspringCreation, neatPlugin.handleNEATArrays, neatPlugin.handleFinalOffspringObjects);
        winRegister.registerConversionFunctions('NEATGenotype', neatPlugin.convertDBObjectToType, neatPlugin.convertTypeToDBObject);
    };

    neatPlugin.handleNEATArrays = function(creationObject, path, childCount, parentObjects)
    {
//        console.log(arguments);
        //so we handle rows this way:
        //if you have an array of genotypes --
        //it can't be guaranteed that parents of vastly different genotypes in those arrays would actually make any sense
        //therefore, at each row, you choose a single parent from the list of filters

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

    //TODO: Most of the wid handling, and setting should be done inside of the win-evolution module, after setting a reference object
    //TODO: it shouldn't be left up to the plugin developer to do this
    neatPlugin.handleNEATOffspringCreation = function(creationObject, path, childCount, parentObjects, schema)
    {
//        console.log('Neat offspring call: ');
//        console.log(arguments);

        //our schema should be ready

        var genomeParents = [];
        for(var p=0; p < parentObjects.length; p++)
        {
            var ng = neatPlugin.convertDBObjectToType(parentObjects[p]);
            genomeParents.push(ng);
        }

        //now we have the parents
        //call in the iec object

        var finalOffspring = [];
        var finalParents = {};

        for(var c=0; c < childCount; c++)
        {
            var par = [];

            //we'll use that to create new objects -- since most of the leg work is done for us already
            var co = iecGenerator.createNextGenome.call(iecGenerator, genomeParents);

            //grab the actual genome
            var offspring = neatPlugin.convertTypeToDBObject(co.offspring);

            //generate the wid for the object
            offspring.wid = cuid();
            offspring.creation = creationObject;
            offspring.dbType = "NEATGenotype";

            var pIDs = [];
            for(var p=0; p < co.parents.length;p++)
            {
                pIDs.push(parentObjects[co.parents[p]].wid);

                //this parent was involved
                par.push(co.parents[p]);
            }

            //mark the wids of the parents
            offspring.parents = pIDs;

            //push the offspring (now complete with proper WID and parental references!
            finalOffspring.push(offspring);
            //not the parents involved
            finalParents[c] = par;
        }

        return {offspring: finalOffspring, parents: finalParents};
    };

    neatPlugin.handleFinalOffspringObjects = function(offspring, parents)
    {
        console.log(arguments);
    };
    //we need a function that can convert an incoming database object into a neat genotype
    neatPlugin.convertDBObjectToType = function(dbObject)
    {
        //need to go from database type into an actual neatgenomtype

        //this is pretty easy
        //we know the "generic" neat setup, we'll just grab nodes and connections
        //if the schema changes, this will need updating -- or can be custom if you want

        var nodes = [];

        var inCount = 0;
        var outCount = 0;

        for(var i=0; i < dbObject.nodes.length; i++)
        {
            var dbNode = dbObject.nodes[i];

            switch(dbNode.nodeType)
            {
                case cppnNode.NodeType.input:
                    inCount++;
                    break;
                case cppnNode.NodeType.output:
                    outCount++;
                    break;
                case cppnNode.NodeType.bias:
                case cppnNode.NodeType.hidden:
                case cppnNode.NodeType.other:
                    break;
                default:
                    console.log('Erroneous node type: ' + dbNode.nodeType);
                    console.log(dbNode);
                    break;
            }

            var nNode = new neatNode.NeatNode(dbNode.gid, dbNode.activationFunction, dbNode.layer, {type: dbNode.nodeType});
            nodes.push(nNode);
        }

        var connections = [];

        for(var i=0; i < dbObject.connections.length; i++)
        {
            //grab connection from db object
            var dbConn = dbObject.connections[i];

            //convert to our neatConnection -- pretty simple
            var nConn = new neatConnection.NeatConnection(dbConn.gid, dbConn.weight, {sourceID: dbConn.sourceID, targetID: dbConn.targetID});

            //push connection object
            connections.push(nConn);
        }

        //here we goooooooooo
        var ng = new neatGenome.NeatGenome(dbObject.wid, nodes, connections, inCount,outCount, false);
        //note the wid we have from the db object (by default this is added)
        ng.wid = dbObject.wid;
        //we also have parents already set as well -- make sure to transfer this inforas well -- it's very important
        ng.parents = dbObject.parents;
        //we've converted back to ng
        //we are finished!
        return ng;
    };

    //this converts a genotype into a database object with the current schema
    //this is how it would be done for a standard neat genotype
    //if it's significantly custom genotype, you'd replace this code
    neatPlugin.convertTypeToDBObject = function(typeObject)
    {
        //TODO: Remove default additions, make this more systematic
        typeObject.absoluteFitness = 0;
        typeObject.behavior = [];
        typeObject.step =0;
        for(var i=0; i < typeObject.nodes.length; i++)
        {
            typeObject.nodes[i].step = 0;
            typeObject.nodes[i].age = 0;
        }
        for(var i=0; i < typeObject.connections.length; i++)
        {
            typeObject.connections[i].step = 0;
            typeObject.connections[i].age = 0;
        }

        //traditionally, this is quite easy actually -- don't do shit
        //neat genome matches the db object pretty much exactly -- hehehe kind of by design -- woops
        return typeObject;
    };


})(typeof exports === 'undefined'? this['win-gen']['neat']={}: exports, this, typeof exports === 'undefined'? true : false);
