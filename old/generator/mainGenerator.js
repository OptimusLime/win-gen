

//For generating artifacts, we load in default generator files
//then we can load in plugins for certain types
(function(exports, selfBrowser, isBrowser){

    var mainWin = isBrowser ? selfBrowser['common'] : require('../win-gen.js');

    var winGen = exports;

//    var winapi = isBrowser ? selfBrowser['common'].loadLibraryFile('win-api', 'win-api') : require('win-api');

    //might have to load differently in browser
    //uuid is a function to be called uuid() -- returning time stamped object

    var winFunc =  mainWin.loadLibraryFile('win-gen', 'win');

    var winbase = isBrowser ? selfBrowser['common'] : require('win-base');

    var uuid = winbase.loadLibraryFile('win-base', 'cuid');

    winGen.CheckDependencies = function()
    {
        uuid = mainWin.loadLibraryFile('win-base', 'cuid');
        winFunc =  mainWin.loadLibraryFile('win-gen', 'win');
    };

    //return random int < max
    var next = function(max)
    {
        return Math.floor(Math.random()*max);
    };

    winGen.convertLocalObjectsFromDB = function(artifactType, artifact)
    {
        //basically, you want the plugins to convert all the returning objects to something that can be used -- not just a json object of stuff
        //e.g. you have a neat genotype -- you want to be able to decode that object into a cppn --
        //if it's just json, it doesn't have those function calls -- hence the plugin callback: convertDBObjectToType
        var localConversion = winFunc.fetchConvertFunction(artifactType).toLocal;
        return localConversion(artifact);
    };

    //let's make a function that generates artifacts from a set of parents
    winGen.createArtifacts = function(creationObject, desiredCount, type, parents)
    {
        //we know the list of parents for these objects!
        if(!parents)
        {
            //no parents provided! We must be interested in loading from a seed!
            //this might be different depending on implementation -- but we'll assume parents come from single seed
            parents = [winFunc.randomSeed()];
        }

        //the first thing we'll do is create a series of objects with unique identifiers

        var schemaTypes = winFunc.getSchemaTypes();
        var schema = schemaTypes[type];


//        console.log('Schema types: ');
//        console.log(schemaTypes);
//        console.log('lookin for: ' + type);

        //we have the basis of the children objects, now we need to fill the objects up!
        var groupChildren = winGen.recursiveCreateChildren(creationObject, '', desiredCount, parents, schema);

        var artifactCallbacks = winFunc.fetchTypeFunction(type);
        //

        var offspring = groupChildren.offspring;
        var parentIxs = groupChildren.parents;

        var finalObjects = {};


        for(var i=0; i < offspring.length; i++)
        {
            var pixs = parentIxs[i];
            var child = offspring[i];


            //create our uuid for the children!

            //assign the child a uuid.v4
            //chance of collision? Almost zero -- depending on how good math.random is...
            var wid = uuid();
            child['wid'] = wid;
            child['dbType'] = type;
            //pass in sessionID information -- handing from above
            //this marks the session we were generated in!
            child['creation'] = creationObject;

            //if we didn't assign a wid, one would be provided by win
            //however, if we have parents and children in the same batch trying to be created
            //assigned a wid is a pretty good idea -- since it's based on time, collisions should be rare
            //not sure what to do in the event of a collision


            var widParents = [];

            //now we must pull the wids from the parents -- if they don't have wid's we need to throw an error
            for(var p=0; p < pixs.length; p++)
            {
                //this is one of the parents we used to generate the child
                var actualParent = parents[pixs[p]];

                if(!actualParent.wid)
                {
                    console.log('Parent is unidentified: ' + pixs[p]);
                    console.log(actualParent);
                    throw new Error('Error creating artifacts -- parents do not have WID identifiers, a necessary nutrient');
                }
                //make it known who the parents are
                widParents.push(actualParent.wid);
            }

            //grab the string identifier -- we rule!
            child['parents'] = widParents;


            finalObjects[wid] = child;
        }

        //if this type does something specific, transferring between parent and offspring or something,
        //here is where it would be done -- after everything is created
        if(artifactCallbacks && artifactCallbacks.final)
            artifactCallbacks.final(finalObjects, parents);

        return finalObjects;
        //huzzah!

    };

    winGen.recursiveCreateChildren = function(creationObject, path, childCount, parentObjects, schemaObject)
    {
//        console.log('rcc-arg');
//        console.log(arguments);

//        console.log('rcc-Path: ' + path + ' cCount : ' + childCount + ' rents: ' + parentObjects + ' schema: ' + schemaObject);
        //move through the schema object, and call relevant construction functions -- if they exist
        var finalOffspring = [];
        var finalParents = {};

        //check if the schema is an array object, this is a must
        var isArray = Array.isArray(schemaObject);

        //we need to process the inside of the schema object
        var innerSchema = isArray ? schemaObject[0] : schemaObject;

//        console.log('Checking: ');
//        console.log(schemaObject);
//        console.log(creationObject);
//        console.log('path');
//        console.log(path);
//        console.log(innerSchema);
//        console.log('end chk');

        var stateAndCallbacks = winFunc.pathOrSchemaStateAndCallbacks(path, innerSchema);

        var state = stateAndCallbacks.state;
        var callbacks = stateAndCallbacks.callbacks;

        //TODO: Better handling of ignore!
        if(state === "ignore")
        {
            var copy;
            //check the path type, are we dbtype? Special case, sorry -- don't know a fancy way to handle
            if(path === 'dbType' || path.substr(path.lastIndexOf('.')+1) === 'dbType')
                copy =  parentObjects[0];

            var offspring = [];
            var fParents = {};

            for(var i=0; i < childCount;i++){
                offspring.push(copy);
                fParents[i] = [];
            }
            return {offspring: offspring, parents: fParents}
        }
        else if(state === "path")
        {
            //there is a path object taking over here.
            //that's responsible for dealing with all dis stuff

            //in reality, maybe we just want the path object to deal with the array aspect
            //need to include this possibility in the future
            if(callbacks.parent)
                return callbacks.parent(creationObject, path, childCount, parentObjects, innerSchema);
            else
            {
                //we're just taking over the array functionality, not the parent functionality
                //who controls the parent callback? Fetch it!
                var cbO = winFunc.onlySchemaToStateAndCB(innerSchema);
                callbacks.parent = cbO.callbacks.parent;

                //absorb state from this object -- we incorporate path through the array callback
                //constructing children otherwise is normal!
                state = cbO.state;

            }
        }

        //we must change the inner schema type to the full schema object, if we're a reference type
        if(state === "reference"){
            //change the inner schema!
            innerSchema = winFunc.getSchemaTypes()[innerSchema['ref']];
        }

        //everything up to this point has been the same for arrays or not arrays
        //however, now we must split!
        if(isArray)
        {
            //no matter what, we have to deal with this array object
            //here is how we select parents from the arrays in the parent objects-- regardless of inner type
            var selectParents = callbacks.array(creationObject, path, childCount, parentObjects);

            var pIx = 0;



            //we need to do this for every child
            for(var c=0; c < childCount; c++)
            {
                //we grab the process for this child
                var process = selectParents[pIx];

                //create an object that's a single child's parental selection
                var potentialParents = winGen.selectParentObjectsForChild(process, parentObjects);

                //we now have the ability to combine parents in order to form objects inside of the array inside each child
                //remember if each of the incoming parent objects is an array, each of the returning children must also be an array
                //potentialParents holds the information on which parents will be used for each index of that array

                var childArray = [];
                var involvedParents = {};

                for(var pot = 0; pot < potentialParents.length; pot++)
                {
                    var aOffspringAndParents;
                    var aParentSelect = potentialParents[pot].parents;
                    var aParentIxs = potentialParents[pot].parentIxs;

                    //process the state and return the object
                    //makes callbacks OR recurses depending on the objects
                    aOffspringAndParents = winGen.processAndReturnOffspring(creationObject, path, state, callbacks, aParentSelect, aParentIxs, innerSchema);

                    for(var p=0; p< aOffspringAndParents.parents.length; p++)
                    {
                        involvedParents[aOffspringAndParents.parents[p]] = true;
                    }

                    //doodley-doo! That ones for you.

                    //single object coming back
                    childArray.push(aOffspringAndParents.offspring);
                }

                var par = [];
                for(var pKey in involvedParents)
                    par.push(pKey);

                //store the parents for this child object!
                finalParents[c] = par;

                //remember, children are arrays -- hence the final offspring count is an array of arrays
                finalOffspring.push(childArray);

                //if aProcess length == 1, then we only have one object that's meant to be
                //applied to every child
                //hence pIx should always = 0, and shouldn't increment with child count
                if(selectParents.length != 1)
                    pIx++;
            }

            //we now have our offspring, and who was involved -- back it goes!
            return {offspring: finalOffspring, parents: finalParents};
        }

        //if we're here, that means we're a straight object
        //we're not an array

        //we need to process our single object, based on parents and current schema

        //parent Ixs just referes back to the parent objects themself
        //this is cause there is no complicated filtering done at this step
        var parentIxs = [];
        for(var i=0; i < parentObjects.length; i++)
            parentIxs.push(i);

        //we need to do this for every child
        for(var c=0; c < childCount; c++)
        {
            var oAndParent = winGen.processAndReturnOffspring(creationObject, path, state, callbacks, parentObjects, parentIxs, innerSchema);
            finalOffspring.push(oAndParent.offspring);
            finalParents[c] = oAndParent.parents;
        }

        return {offspring: finalOffspring, parents: finalParents};
    };


    //returns a single offspring object, and a single array of parent arrays
    //based on parent index sent in
    winGen.processAndReturnOffspring = function(creationObject, path, state, callbacks, parentObjects, aParentIxs, innerSchema)
    {
//        console.log('process: ');
//        console.log(arguments);

        var aOffspringAndParents;
        var finalChild;
        var involvedParents = {};

        //this is an array of parents that we're looking to combine (IF we know how)
        switch(state)
        {
            case "simple":
            case "reference":
                //we know exactly what to do!
                //even if it's a reference type

                //we've verified above that we have a function to call, no worries! Otherwise error was thrown

                //pass if off to the funciton that knows exactly what to do
                aOffspringAndParents = callbacks.parent(creationObject, path, 1, parentObjects, innerSchema);

                //this handles our type, and creates our object for this piece

                //only one object coming back
                finalChild = aOffspringAndParents.offspring[0];
                var pForOff = aOffspringAndParents.parents[0];


                //now we need to do something about tracking the parents involved
                for(var used = 0; used < pForOff.length; used++)
                {
                    //aOffspringAndParents.parent[x] represents the index of the parent used to make the offspring
                    var usedIx = aParentIxs[pForOff[used]];

                    //so we look up inside of our arrayof parent indexes to see which of our parentObjects that corresponds to

                    //we have actually used this object,
                    involvedParents[usedIx] = true;
                }

                break;

            case "complex":
                //we are a complicated object, unfortunately,
                //we have to recursively process the inner object, using our parental info!

                var childObject = {};

                for(var key in innerSchema)
                {
                    //we need to investigate this inner path -- at the key
                    var currentPath = path + (path.length ? '.' : '') + key;

                    //our parents are actually the keyed objects of their parents
                    var keyParents = [];
                    for(var pa =0; pa < parentObjects.length; pa++)
                    {
                        keyParents.push(parentObjects[pa][key]);
                    }

                    //create offspring and the parents responsible
                    var keyOffAndParent = winGen.recursiveCreateChildren(creationObject, currentPath, 1, keyParents, innerSchema[key]);

                    //grab the offspring
                    childObject[key] = keyOffAndParent.offspring[0];
                    var pForOff = keyOffAndParent.parents[0];

                    for(var used = 0; used < pForOff.length; used++)
                    {
                        //keyOff.parent[x] represents the index of the parent used to make the offspring
                        var usedIx = aParentIxs[pForOff[used]];

                        //so we look up inside of our arrayof parent indexes to see which of our parentObjects that corresponds to

                        //we have actually used this object,
                        involvedParents[usedIx] = true;
                    }
                    //the offspring is build one key at a time
                }

                //finally the child object is built -- and we have one array element of the offspring
                finalChild = childObject;

                break;
        }


        var par = [];
        for(var pKey in involvedParents)
            par.push(pKey);

        return {offspring: finalChild, parents: par};
    };


    winGen.selectParentObjectsForChild = function(processObject, parentObjects)
    {

        //the string or array of strings responsible for dictating how to select the children
        //array stuff is unforuntately complicated -- cause how do you merge arrays in a NEAT world.
        var selectionProcess = processObject.selection;

        if(typeof selectionProcess === 'string')
            selectionProcess = [selectionProcess];

        var rowChildArray = [];

        //we pull ALL of the objects from a randomly selected parent
        var pickaparent = next(parentObjects.length);

        //how long will this array be!
        var caLength = processObject.count;

        //special case
        if(selectionProcess[0] === '|')
            caLength = parentObjects[pickaparent].length;

        var sIx = 0;

        //so for each object inside the child,
        //we must choose parent objects, and pass them along
        for(var ca=0; ca < caLength; ca++)
        {

            //now we need to process the selection of parents
            var selectionString = selectionProcess[sIx];

            //We call out to process the parents for this object
            var cParents = winGen.selectParentByString(ca, selectionString, parentObjects, pickaparent);

            //we know the new more specific parents, and we also know from which of the original parentObjects we come from -- parentIxs
            rowChildArray.push(cParents);

            //if we only have one string defining what we do here, don't skip please
            if(selectionProcess.length != 1)
                sIx++;
        }

        //the returning object is an array (of the desired internal size of the offspring)
        //that's full of the parents that need to be processed
        return rowChildArray;
    };


    winGen.selectParentByString = function(rowIx, selectionString, parentObjects, chosenParent)
    {
        //need an array of parents here, for creating children!
        var parents = [];
        var parentIxs = [];

        //if our string is > 1 but less than the parent length,
        if(selectionString.length != 1)
        {
            //if we have a string that's not a single char, but less than the number of objects
            //that means we're skipping the end parents
            for(var x= selectionString.length; x < parentObjects.length; x++)
                selectionString += ',s';
        }

        //now we have to process the selection string
        if(selectionString.length == 1)
        {
            //apply to all parents
            var firstChar = selectionString.charAt(0);
            //special cases here
            switch(firstChar)
            {
                case '|':
                    //special case, we're taking everything from the same parent-- at each row
                    //it's been decided which one before entering the function
                    parents.push(parentObjects[chosenParent][rowIx]);
                    parentIxs.push(chosenParent);

                    break;
                case '-':
                    //we select across rows, this is very specific
                    for(var p=0; p < parentObjects.length; p++)
                    {
                        //rowIx actually represents the row we're currently processing

                        //if we have an object at that array row, we grab it
                        if(parentObjects[p].length >= rowIx){
                            parents.push(parentObjects[p][rowIx]);
                            parentIxs.push(p);
                        }
                    }
                    //parents have been chosen across rows
                    break;
                case '*':
                    //we choose randomly from every parent
                    for(var p=0; p < parentObjects.length; p++)
                    {
                        //select random object from parent -- if it has length
                        if(parentObjects[p].length){
                            var rIx = next(parentObjects[p].length);
                            parents.push(parentObjects[p][rIx]);
                            parentIxs.push(p);
                        }
                    }

                    break;
                case '#':
                    //we select a single object from each parent at this row
                    //har har har

                    var eligible = [];
                    //we select across rows, this is very specific
                    for(var p=0; p < parentObjects.length; p++)
                    {
                        //rowIx actually represents the row we're currently processing
                        //if we have an object at that array row, we can grab it
                        if(parentObjects[p].length >= rowIx)
                            eligible.push(p);
                    }
                    var rIx =  next(eligible.length);

                    //we select the row from the eligible (but random) parent
                    parents.push(parentObjects[eligible[rIx]][rowIx]);
                    parentIxs.push(eligible[rIx]);


                    break;
                case 's':
                    throw new Error("Can't skip when you only have 1 to choose from!: " + path + ' sel: ' + selectionProcess);
                default:
                    throw new Error("Can't send one char to selection if it's not defined special type!: " + path + ' sel: ' + selectionProcess);

            }
        }
        else
        {
            //our selection string is full! it must be, we added 's' buffers if it isn't
            var sSplit = selectionString.split(",");

            if(sSplit.length != parentObjects.length)
                throw new Error("Selection string split must be equal to parent object length: " + path + " sel: " + selectionProcess);
            //each split represents the choice
            for(var ix=0; ix < sSplit.length; ix++)
            {
                //the selection type for this parent
                var sSel = sSplit[ix];

                //the parent object we need
                var po = parentObjects[ix];

                switch(sSel)
                {
                    case "*":
                        //Select any from this parent -- easy!
                        var rIx = next(po.length);
                        parents.push(po[rIx]);
                        parentIxs.push(ix);

                        break;
                    case "-":
                        //Select the row object, if that doesn't exist, select nothing

                        if(po.length >= rowIx){
                            parents.push(po[rowIx]);
                            parentIxs.push(ix);
                        }

                        break;
                    case '|':
                    case "#":
                        //normally indicates select ONLY ONE of the parent objects at that row
                        //in this context (e.g. #,2,3 -- it makes no sense)
                        throw new Error("# Doesn't make sense in this context, it can only be used a single char selection: "
                            + sel + " rowIx: " +  rowIx + " ssel: " + sSel + " selstring: " + selectionString);
                    case 's':
                        //here, we're supposed to skip the parent! Not to be added.

                        break;
                    default:
                        //It's believed to be an actual index
                        var pInt = parseInt(sSel);
                        if(isNaN(pInt))
                            throw new Error("Invalid sel string sent: " + sel + " rowIx: " +  rowIx + " ssel: " + sSel + " selstring: " + selectionString);

                        //we have a number, let's grab parent index
                        if(po[pInt] === undefined)
                            throw new Error("Invalid index sel string sent: " + sel + " rowIx: " +  rowIx + " ssel: " + sSel + " selstring: " + selectionString);

                        //grab the object from the parent array,
                        //it's ours now!
                        parents.push(po[pInt]);
                        parentIxs.push(ix);

                        break;
                }

            }
        }

        return {parents: parents, parentIxs: parentIxs}
    }



})(typeof exports === 'undefined'? this['win-gen']['mainGenerator']={}: exports, this, typeof exports === 'undefined'? true : false);
