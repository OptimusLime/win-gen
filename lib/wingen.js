//need our general utils functions
var winutils = require('win-utils');
var extender = require('./module/backbone.js');
var traverse = require('optimuslime-traverse');

//for component: techjacker/q
var Q = require('q');

var cuid = winutils.cuid;
var wMath = winutils.math;

module.exports = wingen;

function wingen(winBackbone, configuration)
{
    var self = this;

    //grab our backbone object
    self.bb = winBackbone;

    //extend this object to work with win backbone (simple functions)
    //don't want to get that confused -- so it's in another file
    extender(self, configuration);

    //though the following calls can be done in the extender, it's clearer to have them in the main .js file 
    //to see what events are accepted for this module
    var fullEventName = function(partialName)
    {
        return self.winFunction + ":" + partialName;
    }

    //we are evolution
    //these are the various callbacks we accept as events
    self.eventCallbacks = function()
    {
        var callbacks = {};

        //add callbacks to the object-- these are the functions called when the full event is emitted
        callbacks[fullEventName("createArtifacts")] = self.createArtifacts;

        //send back our callbacks
        return callbacks;
    }



    var qBackboneResponse = function()
    {
        var defer = Q.defer();
        // console.log('qBBRes: Original: ', arguments);

        //first add our own function type
        var augmentArgs = arguments;
        [].splice.call(augmentArgs, 0, 0, self.winFunction);
        //make some assumptions about the returning call
        var callback = function(err)
        {
            console.log('Made it back from backbone: ', arguments);
            if(err)
            {
                defer.reject(err);
            }
            else
            {
                //remove the error object, send the info onwards
                [].shift.call(arguments);
                defer.resolve.apply(defer, arguments);
            }
        };

        //then we add our callback to the end of our function -- which will get resolved here with whatever arguments are passed back
        [].push.call(augmentArgs, callback);

        // console.log('qBBRes: Augmented: ', augmentArgs);
        //make the call, we'll catch it inside the callback!
        self.bb.emit.apply(self.bb, augmentArgs);

        return defer.promise;
    }

    var formEncodingRequest = function(type, requestName)
    {
        return "encoding:" + type + "-" + requestName;
    }

    var knowsHowToCreateOffspring = function(type)
    {
        return self.bb.hasListeners(formEncodingRequest(type, "createOffspring"));
    }

    var getReferencePaths = function(traverseSchema)
    {
        var referencePaths = {};
        traverseSchema.forEach(function(node)
        {
            console.log(this);
            if(!this.isLeaf && node.ref)
            {
                //this object has a reference in it
                //store the type for this path 
                //we need to worry about arrays though :/
                referencePaths[this.path] = node.type;
            }
        });
        //send back what we found
        return referencePaths;
    }

    self.processArtifactReferences = function(artifactSchema, count, referencePaths)
    {





    }

    //main function, we need to create the artfiacts
    self.createArtifacts = function(type, count, parents, overrideJSON, finished)
    {
        //didn't pass in an override object
        if(typeof overrideJSON == "function")
        {
            finished = overrideJSON;
            overrideJSON = undefined;
        }

        console.log("Creating artifacts: type: ", type, " cnt: ", count, " parents: ", parents, " override: ", overrideJSON, " callback exists?: ", finished ? "true" : "false");;

        if(!type || !count || !parents || !parents.length || !finished)
            throw new Error("Improper create artifacts inputs: type [string], count [Number], parents [array >= size(1)], callback [function]");
        
        console.log('[generator] beginning to create ' + count + ' artifacts of type "' + type +  '" ')

        // overrideJSON = overrideJSON || {};

        if(knowsHowToCreateOffspring(type))
        {
            //this thing knows how to create it's own offspring
            //therefore, we'll offload the process to that particular type
            //for instance: if you call createArtifacts with a neat type -- we let neat generate the offspring - duh!

            var offspringFetch = formEncodingRequest(type, "createOffspring");
            qBackboneResponse(offspringFetch, count, parents, overrideJSON)
                .then(function(offspring)
                {
                    //if offspring is an array, we fix that 
                    if(typeof offspring != "object")
                    {
                         var keyOffspring = {};
                        for(var i=0; i < offspring.length; i++)
                        {
                            var off = offspring[i];
                            keyOffspring[off.wid] = offspring[i];
                        }
                        //replace our offspring variable with the object
                        offspring = keyOffspring;
                    }
                    //all done, that was easy!
                    finished(offspring);
                })
                .fail(function(err)
                    {
                        console.log("Backbone message failed: ", err);
                    });

            return;
        }

        //otherwise, we're going to get dirty -- we need to do this default style!
        var tOverride = traverse(overrideJSON);


        //now we need to get the schema type 
        var schemaFetch = formEncodingRequest(type, "getEncodingShema");

        //todo: cache these calls - duh! Don't need to call more than once for an app that's already started
        qBackboneResponse(schemaFetch)
            .then(function(artifactSchema)
            {
                //returns the artifact schema
                //the first thing to do is to process the object
                var tSchema = traverse(artifactSchema);

                //pull our reference information for this schema
                var refPaths = getReferencePaths(tSchema);

                //then we do all our non-reference processing first, to create our base objects 
                //then we add to those objects

            });
    }
    
    return self;
}




