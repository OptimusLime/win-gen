//need our general utils functions
module.exports = extendObject;

function extendObject(self, configuration)
{
    //
    self.winFunction = "generator";

    self.rEvents = {encoding: {}};

    console.log("Generator Configs: ", configuration);
    
    //we need to turn configuration into what we need!
    var rEncodings = configuration.encodings || {};

    for(var key in rEncodings)
    {
        //encoding reference type
        var encode = self.rEvents["encoding"];

        //from each encoding, we require the following events
        //handle offspring creation, handle comining arrays of objects
        var offCreate = key + "-" + "createOffspring";
        var arrayLogic = key + "-" + "combineArrays";
        // var finalCall = key + "-" + "finishOffspring";

        encode[offCreate] = "encoding:" + offCreate;
        encode[arrayLogic] = "encoding:" + arrayLogic;

        var reconstitute = key + "-" + "encodingFromJSON";
        var condense = key + "-" + "encodingToJSON";
        var schema = key + "-" + "getEncodingShema";

        encode[reconstitute] = "encoding:" + offCreate;
        encode[condense] = "encoding:" + arrayLogic;
    }

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

    self.requiredEvents = function()
    {
        //don't require any outside modules
        var events = [];
            
        //turn our events into an array
        //events are easier organized as an object, but for requirements, we send as array
        for(var func in self.rEvents)
        {
            for(var action in self.rEvents[func])
            {
                events.push(self.rEvents[func][action]);
            }
        }

        //send back all required events
        return events;
    }

    self.initialize = function(done)
    {
        process.nextTick(function()
        {
            done();
        })
    }
}




