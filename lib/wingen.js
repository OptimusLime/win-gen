//need our general utils functions
var winutils = require('win-utils');
var extendModuleDefinitions = require('./module/backbone.js');
var traverse = require('optimuslime-traverse');
var uuid = require('win-utils').cuid;
//for component: techjacker/q
var Q = require('q');

var cuid = winutils.cuid;
var wMath = winutils.math;

module.exports = wingen;

function wingen(winBackbone, globalConfiguration, localConfiguration)
{
    var self = this;

    //grab our backbone object
    self.bb = winBackbone;

    self.pathDelimiter = "///";

    //all our required events!
    self.rEvents = {
        schema : {
            'validate' : 'schema:validate'
            ,'validateMany' : 'schema:validateMany'
            ,'getFullSchema' : 'schema:getFullSchema'            
            ,'getSchemaReferences' : 'schema:getSchemaReferences'            
            ,'getSchemaProperties' : 'schema:getSchemaProperties'            
        },
        encoding: {}
    };


    //extend this object to work with win backbone (simple functions)
    //don't want to get that confused -- so it's in another file
    extendModuleDefinitions(self, globalConfiguration, localConfiguration);

    //all put together, now let's build an emitter for the backbone
    self.backEmit = winBackbone.getEmitter(self);

    //deal with localConfiguration details

    //should we validate all the parents before generating offspring -- by default no
    //the reasoning: schemas should be written at the module level, it shouldn't be sent in on a whim
    //thereofre it's less likely to happen (normally you use someone elses encoding module -- is the idea)
    self.validateParents = localConfiguration.validateParents || false;
    self.validateOffspring = localConfiguration.validateOffspring || false;


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
        // [].splice.call(augmentArgs, 0, 0, self.winFunction);
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
                if(arguments.length > 1)
                    defer.resolve(arguments);
                else
                    defer.resolve.apply(defer, arguments);
            }
        };

        //then we add our callback to the end of our function -- which will get resolved here with whatever arguments are passed back
        [].push.call(augmentArgs, callback);

        // self.log('qBBRes: Augmented: ', augmentArgs);
        //make the call, we'll catch it inside the callback!
        self.backEmit.apply(self.bb, augmentArgs);

        return defer.promise;
    }

    var formEncodingRequest = function(type, requestName)
    {
        return "encoding:" + type + "-" + requestName;
    }
    var hasBackboneListeners = function(type, eventName)
    {
        return self.backEmit.hasListeners(formEncodingRequest(type, eventName));
    }
    var handlesFullOffspring = function(type)
    {
        return hasBackboneListeners(type, "createFullOffspring");
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

    var qValidation = function(type, objects, shouldValidate)
    {
        var defer = Q.defer();

        if(shouldValidate)
        {
            //gotta do some validation, yeehaw!

            //let our schema object know to validate!
            self.backEmit.emit("schema:validateMany", type, objects, function(err, isValid, reasons)
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

    //just return the generic version of these objects
    function createGenericType(type)
    {
        switch(type)
        {
            case "array":
                return [];
            case "object":
                return {};
            case "number":
            case "integer":
                return 0;
            case "string":
                return "";
            case "boolean":
                return false;
            case "null":
                return null;
        }
    }

    self.qOffspringNonReferences = function(schemaProp, genProps, parentProps, overrideJSON)
    {
        return Q.fcall(function()
        {
            //let's build default non-reference objects
            var offspring = [];
            var parentIxs = [];

            //we're going to need to step through the full schema
            var primaryPaths = schemaProp.primaryPaths;
            var count = genProps.count;

            var pathKeys = Object.keys(primaryPaths);
            pathKeys.sort(function(a,b)
            {
                return a.length - b.length;
            })

            for(var i=0; i < count; i++)
                parentIxs.push([]);

            //now we have sorted our primary paths by length of path ascending
            var createArray = [];

            for(var c=0; c < count; c++)
            {
                var child, tChild;

                for(var i=0; i < pathKeys.length; i++)
                {
                    var path = pathKeys[i];
                    var type = primaryPaths[path].type;
                    if(path == "")
                    {
                        child = createGenericType(type);
                        tChild = traverse(child);
                    }
                    else
                    {
                        //set each path to be the object inside child
                        tChild.set(path.split(self.pathDelimiter), createGenericType(type));
                    }
                }

                offspring.push(child);
            }

            self.log("required: ", genProps.count);
            self.log('paths: ', pathKeys);

            //send back the array of offspring
            return [offspring, parentIxs];
        })
    } 

    function qCallAwareCreateArtifacts()
    {
        var callAware = [].shift.call(arguments);

        var defer = Q.defer();

        [].push.call(arguments, function(err, offspring)
        {
            if(err)
                defer.reject(err);
            else
                defer.resolve({call: callAware, offspringObject: offspring});
        })

        //set things in motion by calling create artifacts with the approrpaite info
        self.createArtifacts.apply(self, arguments);

        return defer.promise;
    }

    function defaultArray(count)
    {
        var offspring = [];
        var parentIxs = [];
        var cArray = [];
        //default behavior for arrays without user defined behavior-- empty! MWAHAHAHAHA
        for(var c=0; c < count; c++){
            offspring.push([]);
            parentIxs.push([]);
        }
        return {offspring: offspring, parentIxs: parentIxs};
    }

    function processArrayBehavior(refInfo, rBehavior, schemaProps, genProps, parentProps, overrideJSON)
    {   
        var offspring, parentIxs;
        var promises = [];

        // self.log('Process array beh:', rBehavior);

        if(rBehavior == undefined)
        {
            var oObj = defaultArray(genProps.count);
            offspring = oObj.offspring;
            parentIxs = oObj.parentIxs;
        }
        else
        {
            //need both offspring and parent info
            if(rBehavior.offspring)
            {
                //we already have offspring info
                offspring = rBehavior.offspring;
                parentIxs = rBehavior.parentIxs;
            }
            else
            {
                //don't have offspring, for now we just do default behavior
                //default behavior
                var oObj = defaultArray(genProps.count);
                offspring = oObj.offspring;
                parentIxs = oObj.parentIxs;
            }

        }

        //send back promises or offspring 
        return {promises: promises, offspring: offspring, parentIxs: parentIxs};
    }

    function processObjectBehavior(refInfo, rBehavior, schemaProps, genProps, parents, overrideJSON)
    {   
        var offspring, parentIxs;
        var promises = [];

        // self.log('Process object beh:', rBehavior);

        if(rBehavior == undefined)
        {
            promises.push(qCallAwareCreateArtifacts(refInfo.objectPath, refInfo.schemaType, genProps.count, parents, overrideJSON));
        }
        else
        {
            //need both offspring and parent info
            //we dont check for parent info -- since it's likely if you sent offspring you have the INTENTION correct, but maybe not the formatting
            //therefore, the parentIxs error will be caught, and the issue will be corrected
            //if we didn't activate unless we have parents AND offspring, it would be more like a silent failure cause they would return children 
            //and nothing would happen
            if(rBehavior.offspring)
            {
                //we already have offspring info
                offspring = rBehavior.offspring;
                parentIxs = rBehavior.parentIxs;
            }
            else
            {
                //don't have offspring, for now we just do default behavior
                //default behavior
                promises.push(qCallAwareCreateArtifacts(refInfo.objectPath, refInfo.schemaType, genProps.count, parents, overrideJSON));
            }
        }

        //send back promises or offspring 
        return {promises: promises, offspring: offspring, parentIxs: parentIxs};
    }
    function scrubDuplicates(array)
    {
        var distinct = {};
        traverse(array).forEach(function(){
            
            if(this.isRoot) return;

            if(!distinct[this.node]){
                distinct[this.node] = true;
            }
            else
                this.remove();
        })
    }
    //need to pull reference objects and send them for creation
    self.qCreateOffspringReferences = function(offspringAndParentIxs, schemaProps, genProps, parentProps, overrideJSON)
    {
        var count = genProps.count; 
        var type = genProps.type;

        var references = schemaProps.references;
        var refCalls = [];
        var refPaths = {};
        var arrayRefInfo = [];

        var offspringToUpdate = offspringAndParentIxs.offspring;
        if(offspringToUpdate.length != count)
            throw new Error("By reference creation, there should be the appropriate number of Offspring:" + count + " Not: " + offspringToUpdate.length);
        
        var tOffspring = [];
        for(var c=0; c < offspringToUpdate.length; c++)
            tOffspring.push(traverse(offspringToUpdate[c]))

        for(var refType in references)
        {
            var rArray = references[refType];
            for(var r=0; r < rArray.length; r++)
            {
                //grab the info
                var refInfo = rArray[r];
                //push the path
                refCalls.push(refInfo.objectPath);
                refPaths[refInfo.objectPath] = refInfo;
            }
        }
        // self.log('Ref vals: '.green,refPaths);

        var tFull = traverse(schemaProps.fullSchema);
        var pathToOffspring = {};

        var p = parentProps.parents;
        var tp = [];
        p.forEach(function(ip){tp.push(traverse(ip))});

        var refPathParents = {};

        for(var rp in refPaths)
        {
            var typeParents = [];
            for(var i=0; i < p.length; i++)
            {
                var pathParent = tp[i].get(rp.split(self.pathDelimiter));
                typeParents.push(pathParent);
            }
            refPathParents[rp] = typeParents;
        }

        // self.log("\n\tParents parents: ".cyan, parentProps.parents);
        // self.log("\n\tReference parents: ".magenta, refPathParents);
        self.log(self.log.testing, "[generator] processing references: ", refCalls);

        return Q.fcall(function()
        {            
             //if we respond to reference behavior
            if(hasBackboneListeners(type, "chooseReferenceBehavior"))
            {
                //if we have the event -- we just do this step elsewhere
                return qBackboneResponse(formEncodingRequest(type, "chooseReferenceBehavior"), refCalls, genProps, parentProps, overrideJSON); 
            }
            else
            {
                //otherwise, we build an array full of default behavior
                return {};
            }
        })
        .then(function(refBehavior)
        {
            refBehavior = refBehavior || {};

            //if we send in an arguments object cause there were multiple return params for some reason
            //just take the first, which is the map fo sho
            if(refBehavior.length)
                refBehavior = refBehavior[0];


            var allPromises = [];

            //go through all our references
            for(var rp in refPaths)
            {
                //path info
                var refInfo = refPaths[rp];

                //index into behavior if it exists
                var rBeh = refBehavior[rp];
                var action;

                var node = tFull.get(refInfo.typePath.split(self.pathDelimiter));
                self.log("Ref ", node);

                if(node.type == "array" || node.items)
                {
                    action = processArrayBehavior(refInfo, rBeh, schemaProps, genProps, refPathParents[rp], overrideJSON);               
                }
                else{
                    action = processObjectBehavior(refInfo, rBeh, schemaProps, genProps, refPathParents[rp], overrideJSON);
                }

                //concat any promises we might have
                if(action.offspring)
                    pathToOffspring[rp] = {offspring: action.offspring, parentIxs: action.parentIxs};


                allPromises = allPromises.concat(action.promises);                
                
            }
            if(allPromises.length)
                return Q.allSettled(allPromises);
            else
                return [];
        })
        .then(function(settled)
        {
            // self.log('Settingled in: ', settled);
            // self.log("Behavior so far: ", pathToOffspring);

            for(var i=0; i < settled.length; i++)
            {
                var create = settled[i];

                if(create.state != "fulfilled")
                {
                    throw new Error("Promise failed: " + JSON.stringify(create.reason));
                }

                //otherwise attach it to our path object

                var offReturn = create.value;
                var path = offReturn.call;

                pathToOffspring[path] = offReturn.offspringObject;
                // self.log('Returned ixs: '.red, offReturn.offspringObject.parentIxs);
            }


            var parentIxs = offspringAndParentIxs.parentIxs;
            //now we have everything we need theoretically
            for(var rp in refPaths)
            {
                var childObjects = pathToOffspring[rp];

                if(!childObjects || !childObjects.offspring || childObjects.offspring.length != count)
                {
                    throw new Error("Child objects not created properly: " + rp + 
                        " err: " + (childObjects && childObjects.offspring ? " wrong number of Offspring " + childObjects.offspring.length : "-- no Offspring found"));
                }

                var objPath = rp.split(self.pathDelimiter);

                //set the path for the Offspring
                for(var c=0; c < count; c++)
                {
                    tOffspring[c].set(objPath, childObjects.offspring[c]);
                    parentIxs[c] = parentIxs[c].concat(childObjects.parentIxs[c]);
                    scrubDuplicates(parentIxs[c]);

                }
            }
        })
        .fail(function(err)
        {   
            //pass the error forward!
            throw err;
        })
    }



    self.qCreateOffspring = function(type, schemaProps, genProps, parentProps, overrideJSON)
    {
        var defer = Q.defer();

        //have several events that must take place accordingly
        //offspring and parents must equal count at the end
        var offspring, parentIxs;

        //how many offspring we need?
        var count = genProps.count;

        Q.fcall(function(){
            //we have to parse the schema object -- we'll do non-reference stuff first
            if(hasBackboneListeners(type, "createNonReferenceOffspring"))
            {
                //if we have the event -- we just do this step elsewhere
                return qBackboneResponse(formEncodingRequest(type, "createNonReferenceOffspring"), genProps, parentProps, overrideJSON); 
            }
            else
            {
                //otherwise, we've got to do it ourselves -- oh boy.
                return self.qOffspringNonReferences(schemaProps, genProps, parentProps, overrideJSON);
            }
        })
        .then(function(offspringAndIxs)
        {
            //pull offspring and parental info
            offspring = offspringAndIxs[0];

            //parentIxs is optional after non-reference objects
            parentIxs = offspringAndIxs[1];

            // self.log('Nonref offspring: ', offspring);

            //must have offspring -- non optional
            if(!offspring || offspring.length != count || !parentIxs || parentIxs.length != count)
            {   
                throw new Error("CreateNonReference: offspring and parent arrays returned must be non-empty equal to count: " + count);
            }
            var offspringAndParentIxs = {offspring: offspring, parentIxs: parentIxs};

            var refCount = Object.keys(schemaProps.references).length;
            // self.log("Refs to operate: ".red, refCount, " for: " + type);
            //now we need to create the reference objects 
            if(refCount)
                return self.qCreateOffspringReferences(offspringAndParentIxs, schemaProps, genProps, parentProps, overrideJSON);
            else
                return;
        })
        .then(function()
        {
            //defer returns NOW
            defer.resolve([offspring, parentIxs]);
        })
        .fail(function(err){

            //we dun messed up
            defer.reject(err);
        })
        


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
        // if(typeof forceParents == "function")
        // {
        //     //dont have parent ixs or override info
        //     finished = forceParents;
        //     forceParents = undefined;
        //     overrideJSON = undefined;
        // }
        // //we have parentIxs but not override info
        // else 
        if(typeof overrideJSON == "function")
        {
            finished = overrideJSON;
            overrideJSON = undefined;
        }

        // self.log("Creating artifacts: type: ", type, " cnt: ", count, " parents: ", parents, " override: ", overrideJSON, " callback exists?: ", finished ? "true" : "false");;
        self.log("[generator] creating ",count, " artifacts of type " , type);

        if(!type || !count || !parents || !parents.length || !finished){
            finished("Improper create artifacts inputs: type [string], count [Number], parents [array >= size(1)], callback [function]");
            return;
        }
        
        self.log('[generator] beginning to create ' + count + ' artifacts of type "' + type +  '" ')

        var failedCreation = false;
        var offspring, oParentIndexes;


        var genProps = {count: count, type : type};
        //parentIxs may be undefined
        var parentProps = {parents: parents};//, force: forceParents};
        var schemaProps;

        // overrideJSON = overrideJSON || {};

        //if we require parental validation, it's going to have to happen now
        qValidation(type, parents, self.validateParents)
            .then(function(isValid)
            {
                // self.log('Parent valid? ', isValid.valid, ' reasons? ', isValid.errors);
                if(!isValid.valid)
                {
                    finished(formatValidationErrors("Parent schema doesn't match type: " + type, isValid.errors));
                    failedCreation = true;
                    return;
                }
                
                // self.log('valid parents- time to make babies'.cyan);
                if(self.validateParents)
                    self.log("[generator] validated parents successfully");
                //we need to fetch two things
                var promises = [];

                promises.push(qBackboneResponse("schema:getFullSchema", type), 
                    qBackboneResponse("schema:getSchemaReferences", type),
                    qBackboneResponse("schema:getSchemaProperties", type));

                return Q.allSettled(promises);
            })
            .then(function(results)
            {
                //let everything fall through -- it's been handled
                if(failedCreation)
                    return;

                // self.log('\tSchema results: '.magenta, results);
                //our results have come back!
                if(results[0].state != "fulfilled" || results[1].state != "fulfilled" || results[2].state != "fulfilled")
                {
                    //we have an error
                    finished({message: "Failed  to get full schema and references", errors: [results[0].reason, results[1].reason, results[2].reason]});
                    return;
                }

                var fullSchema = results[0].value[0];
                var references = results[1].value[0];
                var props = results[2].value[0];


                schemaProps = {fullSchema: fullSchema, primaryPaths: props.primaryPaths, properties: props.properties, references: references};

                // self.log("Full :", fullSchema);
                // self.log("refs : ", references);
                // self.log("Props : ", props);

                //we have the schema and its references
                //check if we know how to make offspring from these objects
                if(handlesFullOffspring(type))
                {
                    // self.log("Encoding knows how to create full: ", type);
                    self.log(self.log.testing, "[generator] calling createFullOffspring for " + type);
                    return qBackboneResponse(formEncodingRequest(type, "createFullOffspring"), genProps, parentProps, overrideJSON);
                }
                else
                {
                    // self.log("Encoding doesn't handle full ", type);
                    self.log(self.log.testing, "[generator] internally creating offspring for " + type);
                    return self.qCreateOffspring(type, schemaProps, genProps, parentProps, overrideJSON);
                }

            })
            .then(function(offspringReturn){

                if(failedCreation)
                    return;

                offspring = offspringReturn[0];
                oParentIndexes = offspringReturn[1];
                var isWIN = schemaProps.properties.isWIN;

                if(!offspring || (isWIN && !oParentIndexes))
                {
                    failedCreation = true;
                    self.log("Undefined: ", arguments);

                    finished({message: "Offspring or parent information cannot be undefined after child creation!"});
                    return;
                }
                else if(offspring.length != count)
                {
                    failedCreation = true;
                    finished({message: "Wrong offspring count: " + offspring.length + " instead of (expected) " + count});
                    return;
                }
                else if(isWIN && oParentIndexes.length != count)
                 {
                    failedCreation = true;
                    finished({message: "Wrong parent information count: " + oParentIndexes.length + " instead of (expected) " + count});
                    return;
                }


                //append info to our offspring -- only if you're a WIN object
                if(schemaProps.properties.isWIN)
                    trackwidAndParentInfo(type, offspring, parents, oParentIndexes);

                self.log('offspring returned: ', offspring, "\nparents: ", oParentIndexes);

                //then we validate if necessary
                return qValidation(type, offspring, self.validateOffspring);
            })
            .then(function(isValid){

                 if(failedCreation)
                    return;

                if(!isValid.valid)
                {
                    failedCreation = true;
                    finished(formatValidationErrors("Offspring failed validation: " + type, isValid.errors));
                    return;
                }
                else
                {
                    //we have valid offspring! away they must go!
                    finished(undefined, {offspring: offspring, parentIxs: oParentIndexes});
                }

            })
            .fail(function(err){
                self.log('Failed create artifacts: ', err);
                self.log(self.log.testing, err.stack)
                finished(formatValidationErrors(err.message, []));
            })
    }

    function formatValidationErrors(msg, errors)
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

        return {message: msg, errors: formErrors};
    }
    function trackwidAndParentInfo(type, offspring, parents, parentIxs)
    {
        for(var i=0; i < offspring.length; i++)
        {
            var pixs = parentIxs[i];
            var child = offspring[i];

            //generate a strongly unique id
            var wid = uuid();

            //give it an id and a type for tracking info
            child.wid = wid;
            child.dbType = type;
            //note: we don't record sessionID here. That's provided elsewhere, where it's more appropriate -- e.g. at evolution

            //going to create it's actual parents according to parent IXs
            var widParents = [];

            if(!pixs.length)
            {
                //all parents become responsible if no-one is mentioned specifically
                for(var p=0; p < parents.length; p++)
                    pixs.push(p);
               // self.log('No parent index array listed!');
               // throw new Error("You can't come from nothing! ParentIXs must list what parent index the offspring came from.");
            }

            //now we must pull the wids from the parents -- if they don't have wid's we need to throw an error
            for(var p=0; p < pixs.length; p++)
            {
                //this is one of the parents we used to generate the child
                var actualParent = parents[pixs[p]];

                if(!actualParent)
                {
                    self.log('Invalid parentIx: ' + pixs[p] + " only " + parents.length + " parents");
                    throw new Error('Invalid parentIx: '+ pixs[p] + " only " + parents.length + " parents");
                }
                else if(!actualParent.wid)
                {
                    self.log('Parent is unidentified: ' + pixs[p]);
                    self.log(actualParent);
                    throw new Error('Error creating artifacts -- parents do not have WID identifiers, a necessary nutrient');
                }
                //make it known who the parents are
                widParents.push(actualParent.wid);
            }

            //grab the string identifier -- we rule!
            child.parents = widParents;
        }
    }
    
    return self;
}




