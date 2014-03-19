//need our general utils functions
var winutils = require('win-utils');
var extendModuleDefinitions = require('./module/backbone.js');
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

    //pull logging from the backbone -- handles all messages to the user
    self.log = winBackbone.log;

    configuration = configuration || {};

    //all our required events!
    self.rEvents = {
        schema : {
            'validate' : 'schema:validate'
            ,'validateMany' : 'schema:validateMany'
            ,'getFullSchema' : 'schema:getFullSchema'            
        },
        encoding: {}
    };


    //extend this object to work with win backbone (simple functions)
    //don't want to get that confused -- so it's in another file
    extendModuleDefinitions(self, configuration);

    //deal with configuration details

    //should we validate all the parents before generating offspring -- by default no
    //the reasoning: schemas should be written at the module level, it shouldn't be sent in on a whim
    //thereofre it's less likely to happen (normally you use someone elses encoding module -- is the idea)
    self.validateParents = configuration.validateParents || false;


    //though the following calls can be done in the extendModuleDefinitions, it's clearer to have them in the main .js file 
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
        // self.log('qBBRes: Original: ', arguments);

        //first add our own function type
        var augmentArgs = arguments;
        [].splice.call(augmentArgs, 0, 0, self.winFunction);
        //make some assumptions about the returning call
        var callback = function(err)
        {
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

        // self.log('qBBRes: Augmented: ', augmentArgs);
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
            self.log(this);
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

    var qValidation = function(type, parents)
    {
        var defer = Q.defer();

        if(self.validateParents)
        {
            //gotta do some validation, yeehaw!

            //let our schema object know to validate!
            self.bb.emit(self.winFunction, "schema:validateMany", type, parents, function(err, isValid, reasons)
            {
                if(err)
                    defer.reject(err);
                else
                    defer.resolve({valid: isValid, errors: reasons});
            });
        }
        else
        {
            //no validation required, resolve immediately
            setTimeout(function()
            {
                defer.resolve(true);
            })
        }


        return defer.promise;
    }

    //main function, we need to create the artfiacts
    self.createArtifacts = function(type, count, parents, overrideJSON, finished)
    {
        if(typeof type != "string" || !Array.isArray(parents) || typeof count != "number")
        {
            finished("Create artifacts requires type [string], count [number], parents [array]");
            return;
        }
        //didn't pass in an override object
        if(typeof overrideJSON == "function")
        {
            finished = overrideJSON;
            overrideJSON = undefined;
        }

        self.log("Creating artifacts: type: ", type, " cnt: ", count, " parents: ", parents, " override: ", overrideJSON, " callback exists?: ", finished ? "true" : "false");;

        if(!type || !count || !parents || !parents.length || !finished)
            finished("Improper create artifacts inputs: type [string], count [Number], parents [array >= size(1)], callback [function]");
        
        self.log('[generator] beginning to create ' + count + ' artifacts of type "' + type +  '" ')

        //if we require parental validation, it's going to have to happen now
        qValidation(type, parents)
            .then(function(isValid)
            {
                // self.log('Parent valid? ', isValid.valid, ' reasons? ', isValid.errors);
                if(!isValid.valid)
                {
                    finished({message: "Parent schema doesn't match type: " + type + " ", errors: formatValidationErrors(isValid.errors)});
                    return;
                }

            })
            .fail(function(err){

            })


        // overrideJSON = overrideJSON || {};

        // if(knowsHowToCreateOffspring(type))
        // {
        //     //this thing knows how to create it's own offspring
        //     //therefore, we'll offload the process to that particular type
        //     //for instance: if you call createArtifacts with a neat type -- we let neat generate the offspring - duh!

        //     var offspringFetch = formEncodingRequest(type, "createOffspring");
        //     qBackboneResponse(offspringFetch, count, parents, overrideJSON)
        //         .then(function(offspring)
        //         {
        //             //if offspring is an array, we fix that 
        //             if(typeof offspring != "object")
        //             {
        //                  var keyOffspring = {};
        //                 for(var i=0; i < offspring.length; i++)
        //                 {
        //                     var off = offspring[i];
        //                     keyOffspring[off.wid] = offspring[i];
        //                 }
        //                 //replace our offspring variable with the object
        //                 offspring = keyOffspring;
        //             }
        //             //all done, that was easy!
        //             finished(offspring);
        //         })
        //         .fail(function(err)
        //             {
        //                 self.log("Backbone message failed: ", err);
        //             });

        //     return;
        // }

        // //otherwise, we're going to get dirty -- we need to do this default style!
        // var tOverride = traverse(overrideJSON);


        // //now we need to get the schema type 
        // var schemaFetch = formEncodingRequest(type, "getEncodingShema");

        // //todo: cache these calls - duh! Don't need to call more than once for an app that's already started
        // qBackboneResponse(schemaFetch)
        //     .then(function(artifactSchema)
        //     {
        //         //returns the artifact schema
        //         //the first thing to do is to process the object
        //         var tSchema = traverse(artifactSchema);

        //         //pull our reference information for this schema
        //         var refPaths = getReferencePaths(tSchema);

        //         //then we do all our non-reference processing first, to create our base objects 
        //         //then we add to those objects

        //     });
    }


    function formatValidationErrors(errors)
    {
         var formErrors = [];
        //should form the error message appropriates
        for(var i=0; i < errors.length; i++)
        {
            var errArray = errors[i];
            var reform = [];
            for(var e=0; e < errArray.length; e++)
            {   
                var err = errArray[e];
                var oErr= {};
                if(err.dataPath) oErr.dataPath = err.dataPath;
                oErr.message = err.message;

                reform.push(oErr);
            }
            formErrors.push(reform);
        }

        return formErrors;
    }

    
    return self;
}




